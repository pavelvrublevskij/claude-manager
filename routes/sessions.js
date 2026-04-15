const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { safeSlug, wrapRoute } = require('../lib/file-helpers');
const { getProjectUsageMap } = require('../lib/usage-index');
const { decodeSlug } = require('../lib/slug');

const router = express.Router({ mergeParams: true });

function launchTerminal(projectPath, cmd) {
  const platform = process.platform;
  if (platform === 'win32') {
    const wtArgs = ['-d', projectPath, 'cmd.exe', '/k', cmd];
    const proc = spawn('wt.exe', wtArgs, { detached: true, stdio: 'ignore' });
    proc.on('error', () => {
      spawn('cmd.exe', ['/c', `start "" cmd.exe /k "cd /d ${projectPath} && ${cmd}"`], { shell: true, detached: true, stdio: 'ignore' }).unref();
    });
    proc.unref();
  } else if (platform === 'darwin') {
    const script = `tell application "Terminal" to do script "cd '${projectPath}' && ${cmd}"`;
    execFile('osascript', ['-e', script]);
  } else {
    const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
    for (const term of terminals) {
      try {
        const args = term === 'gnome-terminal'
          ? ['--', 'bash', '-c', `cd '${projectPath}' && ${cmd}; exec bash`]
          : ['-e', `bash -c "cd '${projectPath}' && ${cmd}; exec bash"`];
        execFile(term, args);
        return;
      } catch (_) { continue; }
    }
    throw new Error('No supported terminal found');
  }
}

router.get('/:slug/sessions', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const indexFile = path.join(dir, 'sessions-index.json');
  if (fs.existsSync(indexFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      const sessions = (data.entries || []).map(e => ({
        sessionId: e.sessionId,
        summary: e.summary || '',
        firstPrompt: e.firstPrompt || '',
        messageCount: e.messageCount || 0,
        created: e.created || null,
        modified: e.modified || null,
        gitBranch: e.gitBranch || '',
        isSidechain: e.isSidechain || false
      }));
      const usageMap = getProjectUsageMap(req.params.slug);
      sessions.forEach(s => {
        const u = usageMap[s.sessionId];
        if (u) { s.tokens = u.totals; s.cost = u.cost; s.models = Object.keys(u.byModel || {}); }
      });
      sessions.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));
      return res.json(sessions);
    } catch (_) { /* malformed index, fall through to JSONL parsing */ }
  }

  // Fallback: parse .jsonl files directly
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  const sessions = files.map(f => {
    const filePath = path.join(dir, f);
    const stat = fs.statSync(filePath);
    const session = {
      sessionId: f.replace('.jsonl', ''),
      summary: '',
      firstPrompt: '',
      messageCount: 0,
      created: null,
      modified: null,
      gitBranch: '',
      lastGitBranch: '',
      isSidechain: false
    };

    try {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
      let userMessages = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'user') {
            userMessages++;
            if (userMessages === 1) {
              session.firstPrompt = typeof entry.message?.content === 'string'
                ? entry.message.content.slice(0, 200)
                : '';
              session.created = entry.timestamp || stat.birthtime.toISOString();
              session.gitBranch = entry.gitBranch || '';
            }
            if (entry.gitBranch) session.lastGitBranch = entry.gitBranch;
            session.modified = entry.timestamp || stat.mtime.toISOString();
          }
        } catch (_) { /* malformed JSONL line, skip */ }
      }
      session.messageCount = userMessages;
      if (!session.created) session.created = stat.birthtime.toISOString();
      if (!session.modified) session.modified = stat.mtime.toISOString();
    } catch (_) {
      /* unreadable file, use stat times */
      session.created = stat.birthtime.toISOString();
      session.modified = stat.mtime.toISOString();
    }

    return session;
  });

  const usageMap = getProjectUsageMap(req.params.slug);
  const filtered = sessions.filter(s => s.messageCount > 0);
  filtered.forEach(s => {
    const u = usageMap[s.sessionId];
    if (u) { s.tokens = u.totals; s.cost = u.cost; s.models = Object.keys(u.byModel || {}); }
  });
  filtered.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  res.json(filtered);
}));

router.get('/:slug/sessions/search', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const qLower = q.toLowerCase();
  const MAX_SNIPPETS = 3;
  const SNIPPET_RADIUS = 75;

  // Load index metadata if available
  const indexMeta = {};
  const indexFile = path.join(dir, 'sessions-index.json');
  if (fs.existsSync(indexFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      for (const e of (data.entries || [])) {
        indexMeta[e.sessionId] = e;
      }
    } catch (_) {}
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  const results = [];

  for (const f of files) {
    const sessionId = f.replace('.jsonl', '');
    const filePath = path.join(dir, f);
    const snippets = [];
    let messageCount = 0;
    let firstPrompt = '';
    let created = null;
    let modified = null;
    let gitBranch = '';
    let lastGitBranch = '';

    try {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'user' && entry.type !== 'assistant') continue;

          if (entry.type === 'user') {
            messageCount++;
            if (messageCount === 1) {
              firstPrompt = typeof entry.message?.content === 'string'
                ? entry.message.content.slice(0, 200) : '';
              created = entry.timestamp;
              gitBranch = entry.gitBranch || '';
            }
            if (entry.gitBranch) lastGitBranch = entry.gitBranch;
            modified = entry.timestamp;
          }

          if (snippets.length >= MAX_SNIPPETS) continue;

          const content = entry.message?.content;
          const role = entry.type;
          const searchBlocks = [];

          if (typeof content === 'string') {
            searchBlocks.push({ text: content, label: '' });
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text') {
                searchBlocks.push({ text: block.text, label: '' });
              } else if (block.type === 'tool_use') {
                const inputStr = typeof block.input === 'string'
                  ? block.input
                  : JSON.stringify(block.input);
                searchBlocks.push({ text: inputStr, label: block.name || 'tool' });
              } else if (block.type === 'tool_result') {
                let resultText = '';
                if (typeof block.content === 'string') {
                  resultText = block.content;
                } else if (Array.isArray(block.content)) {
                  resultText = block.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
                }
                if (resultText) searchBlocks.push({ text: resultText, label: 'result' });
              }
            }
          }

          for (const sb of searchBlocks) {
            if (snippets.length >= MAX_SNIPPETS) break;
            const idx = sb.text.toLowerCase().indexOf(qLower);
            if (idx === -1) continue;
            const start = Math.max(0, idx - SNIPPET_RADIUS);
            const end = Math.min(sb.text.length, idx + q.length + SNIPPET_RADIUS);
            let snippet = (start > 0 ? '...' : '') + sb.text.slice(start, end) + (end < sb.text.length ? '...' : '');
            snippet = snippet.replace(/\n/g, ' ');
            snippets.push({ text: snippet, role, label: sb.label });
          }
        } catch (_) {}
      }
    } catch (_) { continue; }

    // Also check index metadata (summary/firstPrompt)
    const meta = indexMeta[sessionId];
    if (snippets.length === 0 && meta) {
      const checkFields = [meta.summary, meta.firstPrompt].filter(Boolean);
      for (const field of checkFields) {
        if (field.toLowerCase().includes(qLower)) {
          const idx = field.toLowerCase().indexOf(qLower);
          const start = Math.max(0, idx - SNIPPET_RADIUS);
          const end = Math.min(field.length, idx + q.length + SNIPPET_RADIUS);
          snippets.push({ text: field.slice(start, end), role: 'meta', label: '' });
          break;
        }
      }
    }

    if (snippets.length === 0) continue;

    const session = {
      sessionId,
      summary: meta?.summary || '',
      firstPrompt: meta?.firstPrompt || firstPrompt,
      messageCount: meta?.messageCount || messageCount,
      created: meta?.created || created,
      modified: meta?.modified || modified,
      gitBranch: meta?.gitBranch || gitBranch,
      lastGitBranch: meta?.lastGitBranch || lastGitBranch,
      isSidechain: meta?.isSidechain || false,
      snippets
    };
    results.push(session);
  }

  const usageMap = getProjectUsageMap(req.params.slug);
  results.forEach(s => {
    const u = usageMap[s.sessionId];
    if (u) { s.tokens = u.totals; s.cost = u.cost; s.models = Object.keys(u.byModel || {}); }
  });
  results.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));
  res.json(results);
}));

router.get('/:slug/sessions/:sessionId', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const sessionId = req.params.sessionId;
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const filePath = path.join(dir, sessionId + '.jsonl');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Session not found' });

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const messages = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' || entry.type === 'assistant') {
        const msg = {
          role: entry.type,
          timestamp: entry.timestamp,
          gitBranch: entry.gitBranch || '',
          model: entry.message?.model || '',
          content: []
        };

        const content = entry.message?.content;
        if (typeof content === 'string') {
          msg.content.push({ type: 'text', text: content });
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              msg.content.push({ type: 'text', text: block.text });
            } else if (block.type === 'tool_use') {
              msg.content.push({
                type: 'tool_use',
                name: block.name,
                input: block.input
              });
            } else if (block.type === 'tool_result') {
              let resultText = '';
              if (typeof block.content === 'string') {
                resultText = block.content.slice(0, 2000);
              } else if (Array.isArray(block.content)) {
                resultText = block.content
                  .filter(c => c.type === 'text')
                  .map(c => c.text)
                  .join('\n')
                  .slice(0, 2000);
              }
              msg.content.push({ type: 'tool_result', text: resultText });
            } else if (block.type === 'thinking') {
              // skip thinking blocks
            }
          }
        }

        if (msg.content.length > 0) {
          messages.push(msg);
        }
      }
    } catch (_) { /* malformed JSONL line, skip */ }
  }

  messages.reverse();
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 20;
  const page = messages.slice(offset, offset + limit);
  res.json({ messages: page, total: messages.length, hasMore: offset + limit < messages.length });
}));

router.post('/:slug/sessions/new', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const projectPath = decodeSlug(req.params.slug);
  try {
    launchTerminal(projectPath, 'claude');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to open terminal: ' + e.message });
  }
}));

router.post('/:slug/sessions/:sessionId/resume', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const sessionId = req.params.sessionId;
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const filePath = path.join(dir, sessionId + '.jsonl');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Session not found' });

  const projectPath = decodeSlug(req.params.slug);
  try {
    launchTerminal(projectPath, `claude --resume "${sessionId}"`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to open terminal: ' + e.message });
  }
}));

module.exports = router;
