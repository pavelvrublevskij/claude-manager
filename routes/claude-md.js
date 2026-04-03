const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { GLOBAL_CLAUDE_MD } = require('../lib/paths');

const router = express.Router();

router.get('/global', wrapRoute((req, res) => {
  try {
    const content = fs.readFileSync(GLOBAL_CLAUDE_MD, 'utf-8');
    res.json({ content });
  } catch (e) {
    res.status(404).json({ error: 'Global CLAUDE.md not found' });
  }
}));

router.put('/global', wrapRoute((req, res) => {
  backup(GLOBAL_CLAUDE_MD);
  fs.writeFileSync(GLOBAL_CLAUDE_MD, req.body.content, 'utf-8');
  res.json({ ok: true });
}));

function findProjectClaudeMd(projectPath) {
  const candidates = [
    path.join(projectPath, '.claude', 'CLAUDE.md'),
    path.join(projectPath, 'CLAUDE.md')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

router.get('/project/:slug', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = findProjectClaudeMd(decodedPath);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (e) {
    res.status(404).json({ error: 'Project CLAUDE.md not found', path: filePath });
  }
}));

router.put('/project/:slug', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = findProjectClaudeMd(decodedPath);

  backup(filePath);
  fs.writeFileSync(filePath, req.body.content, 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
