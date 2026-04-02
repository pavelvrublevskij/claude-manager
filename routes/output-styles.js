const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, wrapRoute } = require('../lib/file-helpers');
const { readFrontmatterFile, readFrontmatterDir, writeFrontmatter } = require('../lib/frontmatter');
const { OUTPUT_STYLES_DIR } = require('../lib/paths');

const router = express.Router();

router.get('/', (req, res) => {
  const styles = readFrontmatterDir(OUTPUT_STYLES_DIR).map(s => ({
    filename: s.filename,
    name: s.name || s.filename.replace('.md', ''),
    description: s.description || '',
    frontmatter: { name: s.name, description: s.description, ...s },
    content: s.content
  }));
  res.json(styles);
});

router.put('/:filename', wrapRoute((req, res) => {
  fs.mkdirSync(OUTPUT_STYLES_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_STYLES_DIR, req.params.filename);
  backup(filePath);
  writeFrontmatter(filePath, req.body.frontmatter || {}, req.body.content || '');
  res.json({ ok: true });
}));

router.delete('/:filename', wrapRoute((req, res) => {
  const filePath = path.join(OUTPUT_STYLES_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  backup(filePath);
  fs.unlinkSync(filePath);
  res.json({ ok: true });
}));

module.exports = router;
