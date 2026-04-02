const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, readJson, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { CLAUDE_DIR, MCP_FILE } = require('../lib/paths');

const router = express.Router();

router.get('/global', (req, res) => {
  res.json(readJson(MCP_FILE, { servers: {} }));
});

router.get('/cloud', (req, res) => {
  const creds = readJson(path.join(CLAUDE_DIR, '.credentials.json'), {});
  const mcpOAuth = creds.mcpOAuth || {};
  const integrations = Object.keys(mcpOAuth).map(key => {
    const parts = key.split('|');
    return { key, provider: parts[0] || key, id: parts[1] || '' };
  });
  res.json(integrations);
});

router.put('/global', wrapRoute((req, res) => {
  backup(MCP_FILE);
  fs.writeFileSync(MCP_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ ok: true });
}));

router.get('/project/:slug', (req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = path.join(decodedPath, '.claude', '.mcp.json');
  res.json({ data: readJson(filePath, { servers: {} }), path: filePath });
});

router.put('/project/:slug', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = path.join(decodedPath, '.claude', '.mcp.json');
  fs.mkdirSync(path.join(decodedPath, '.claude'), { recursive: true });
  backup(filePath);
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
