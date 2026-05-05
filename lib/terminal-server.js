const path = require('path');
const fs = require('fs');
const url = require('url');
const WebSocket = require('ws');
const { safeSlug } = require('./file-helpers');
const { decodeSlug } = require('./slug');

let pty = null;
try { pty = require('node-pty'); } catch (_) { /* pty unavailable; WS will reject */ }

const wss = new WebSocket.Server({ noServer: true });

const TERMINAL_PATH_RE = /^\/api\/projects\/([^/]+)\/terminal$/;

function validateTerminal(slug, sessionId) {
  if (!slug) return { ok: false, status: 400, error: 'Invalid slug' };
  const dir = safeSlug(slug);
  if (!dir) return { ok: false, status: 400, error: 'Invalid slug' };

  if (sessionId) {
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
      return { ok: false, status: 400, error: 'Invalid session ID' };
    }
    const filePath = path.join(dir, sessionId + '.jsonl');
    if (!fs.existsSync(filePath)) return { ok: false, status: 404, error: 'Session not found' };
  }

  const projectPath = decodeSlug(slug);
  return { ok: true, projectPath, sessionId: sessionId || '' };
}

function rejectUpgrade(socket, status, error) {
  const reason = status === 400 ? 'Bad Request' : status === 404 ? 'Not Found' : 'Service Unavailable';
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\n` +
    'Content-Type: text/plain\r\n' +
    `Content-Length: ${Buffer.byteLength(error)}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    error
  );
  socket.destroy();
}

function handleUpgrade(req, socket, head) {
  const parsed = url.parse(req.url, true);
  const match = (parsed.pathname || '').match(TERMINAL_PATH_RE);
  if (!match) return false;

  if (!pty) {
    rejectUpgrade(socket, 503, 'node-pty is not installed');
    return true;
  }

  const slug = decodeURIComponent(match[1]);
  const sessionId = (parsed.query && parsed.query.sessionId) || '';
  const result = validateTerminal(slug, sessionId);
  if (!result.ok) {
    rejectUpgrade(socket, result.status, result.error);
    return true;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    setupSession(ws, result.projectPath, result.sessionId);
  });
  return true;
}

function spawnClaudePty(projectPath, sessionId, opts) {
  const resumeArgs = sessionId ? ['--resume', sessionId] : [];
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd.exe' : 'claude';
  const args = isWin ? ['/c', 'claude'].concat(resumeArgs) : resumeArgs;
  return pty.spawn(cmd, args, {
    name: 'xterm-256color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: projectPath,
    env: Object.assign({}, process.env, { TERM: 'xterm-256color' })
  });
}

function setupSession(ws, projectPath, sessionId) {
  let term;
  try {
    term = spawnClaudePty(projectPath, sessionId, { cols: 80, rows: 24 });
  } catch (e) {
    try {
      ws.send(`\r\n\x1b[31mFailed to start claude: ${e.message}\x1b[0m\r\n`);
    } catch (_) {}
    ws.close();
    return;
  }

  let killed = false;

  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data); } catch (_) {}
    }
  });

  term.onExit(({ exitCode }) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(`\r\n\x1b[33m[claude exited (code ${exitCode})]\x1b[0m\r\n`);
        ws.close();
      } catch (_) {}
    }
  });

  ws.on('message', msg => {
    let payload;
    try { payload = JSON.parse(msg.toString()); } catch (_) { return; }
    if (!payload || typeof payload !== 'object') return;
    if (payload.t === 'i' && typeof payload.d === 'string') {
      try { term.write(payload.d); } catch (_) {}
    } else if (payload.t === 'r' && Number.isFinite(payload.c) && Number.isFinite(payload.r) && payload.c > 0 && payload.r > 0) {
      try { term.resize(payload.c, payload.r); } catch (_) {}
    }
  });

  ws.on('close', () => {
    if (killed) return;
    killed = true;
    try { term.kill(); } catch (_) {}
  });
}

module.exports = { handleUpgrade, validateTerminal, ptyAvailable: () => !!pty };
