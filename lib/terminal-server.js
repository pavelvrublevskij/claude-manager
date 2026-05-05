const path = require('path');
const fs = require('fs');
const url = require('url');
const WebSocket = require('ws');
const { safeSlug } = require('./file-helpers');
const { decodeSlug } = require('./slug');

let pty = null;
try { pty = require('node-pty'); } catch (_) { /* pty unavailable; WS will reject */ }

const wss = new WebSocket.Server({ noServer: true });

// One active pty per (slug, sessionId). Empty sessionId is not tracked
// because each empty-sessionId pty spawns a fresh `claude` session.
const activeTerminals = new Map();
const activeKey = (slug, sessionId) => sessionId ? `${slug}|${sessionId}` : null;

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
    setupSession(ws, result.projectPath, slug, result.sessionId);
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

function setupSession(ws, projectPath, slug, sessionId) {
  // Attach an error listener immediately. Without it, an unhandled 'error' event
  // on the ws during any close path (conflict, spawn failure, normal teardown)
  // would crash the Node process. The 'close' handler does the actual cleanup.
  ws.on('error', () => { /* swallow */ });

  const key = activeKey(slug, sessionId);
  if (key && activeTerminals.has(key)) {
    try {
      ws.send('\r\n\x1b[31mAnother browser terminal is already connected to this session.\x1b[0m\r\n');
      ws.send('\x1b[31mClose it before opening a new one.\x1b[0m\r\n');
    } catch (_) {}
    ws.close();
    return;
  }

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

  // Single state machine for the terminal session. terminate() is idempotent:
  // it kills the pty and closes the ws AT MOST ONCE. Without this, calling
  // disconnectFor + ws.on('close') back-to-back ended up calling term.kill()
  // twice on Windows ConPTY, which can abort the Node process with no log.
  const entry = {
    ws,
    term,
    terminated: false,
    terminate(reason) {
      if (this.terminated) return;
      this.terminated = true;
      if (reason) {
        try {
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(`\r\n\x1b[33m${reason}\x1b[0m\r\n`);
          }
        } catch (_) {}
      }
      try { this.term.kill(); } catch (_) {}
      try { this.ws.close(); } catch (_) {}
      if (key) activeTerminals.delete(key);
    }
  };
  if (key) activeTerminals.set(key, entry);

  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data); } catch (_) {}
    }
  });

  term.onExit(({ exitCode }) => {
    if (entry.terminated) return;
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(`\r\n\x1b[33m[claude exited (code ${exitCode})]\x1b[0m\r\n`);
      } catch (_) {}
    }
    entry.terminated = true;
    try { ws.close(); } catch (_) {}
    if (key) activeTerminals.delete(key);
  });

  ws.on('message', msg => {
    if (entry.terminated) return;
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
    if (entry.terminated) return;
    entry.terminated = true;
    try { term.kill(); } catch (_) {}
    if (key) activeTerminals.delete(key);
  });
}

function disconnectFor(slug, sessionId, reason) {
  const key = activeKey(slug, sessionId);
  if (!key) return false;
  const entry = activeTerminals.get(key);
  if (!entry) return false;
  entry.terminate(reason || 'Terminal closed by another action.');
  return true;
}

function hasActiveTerminal(slug, sessionId) {
  const key = activeKey(slug, sessionId);
  return !!(key && activeTerminals.has(key));
}

module.exports = {
  handleUpgrade,
  validateTerminal,
  disconnectFor,
  hasActiveTerminal,
  ptyAvailable: () => !!pty
};
