const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { readFrontmatterFile, readFrontmatterDir, writeFrontmatter } = require('../lib/frontmatter');

const router = express.Router();

router.get('/project/:slug', (req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const dir = path.join(decodedPath, '.claude', 'agents');
  const agents = readFrontmatterDir(dir).map(a => ({
    filename: a.filename,
    name: a.name || a.filename.replace('.md', ''),
    description: a.description || '',
    frontmatter: { name: a.name, description: a.description, ...a },
    content: a.content
  }));
  res.json(agents);
});

router.get('/project/:slug/:filename', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = path.join(decodedPath, '.claude', 'agents', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const { frontmatter, content, raw } = readFrontmatterFile(filePath);
  res.json({ filename: req.params.filename, frontmatter, content, raw });
}));

router.put('/project/:slug/:filename', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const dir = path.join(decodedPath, '.claude', 'agents');
  const filePath = path.join(dir, req.params.filename);
  fs.mkdirSync(dir, { recursive: true });
  backup(filePath);
  writeFrontmatter(filePath, req.body.frontmatter || {}, req.body.content || '');
  res.json({ ok: true });
}));

router.delete('/project/:slug/:filename', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const filePath = path.join(decodedPath, '.claude', 'agents', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  backup(filePath);
  fs.unlinkSync(filePath);
  res.json({ ok: true });
}));

module.exports = router;
