const express = require('express');
const fs = require('fs');
const path = require('path');
const { safeSlug, wrapRoute } = require('../lib/file-helpers');
const { getProjectUsageMap } = require('../lib/usage-index');

const router = express.Router({ mergeParams: true });

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
        if (u) { s.tokens = u.totals; s.cost = u.cost; }
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
    if (u) { s.tokens = u.totals; s.cost = u.cost; }
  });
  filtered.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  res.json(filtered);
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

module.exports = router;
