const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { readFrontmatterFile, writeFrontmatter } = require('../lib/frontmatter');
const { SKILLS_DIR } = require('../lib/paths');

const router = express.Router();

function listSkills(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const skillFile = path.join(dir, d.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) return null;
      const { frontmatter, content } = readFrontmatterFile(skillFile);
      return {
        name: d.name,
        title: frontmatter.name || d.name,
        description: frontmatter.description || '',
        frontmatter,
        content
      };
    }).filter(Boolean);
}

router.get('/global', (req, res) => {
  res.json(listSkills(SKILLS_DIR));
});

router.get('/global/:name', wrapRoute((req, res) => {
  const skillFile = path.join(SKILLS_DIR, req.params.name, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return res.status(404).json({ error: 'Not found' });
  const { frontmatter, content, raw } = readFrontmatterFile(skillFile);
  res.json({ name: req.params.name, frontmatter, content, raw });
}));

router.put('/global/:name', wrapRoute((req, res) => {
  const dir = path.join(SKILLS_DIR, req.params.name);
  const skillFile = path.join(dir, 'SKILL.md');
  fs.mkdirSync(dir, { recursive: true });
  backup(skillFile);
  writeFrontmatter(skillFile, req.body.frontmatter || {}, req.body.content || '');
  res.json({ ok: true });
}));

router.delete('/global/:name', wrapRoute((req, res) => {
  const dir = path.join(SKILLS_DIR, req.params.name);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Not found' });
  const skillFile = path.join(dir, 'SKILL.md');
  backup(skillFile);
  fs.rmSync(dir, { recursive: true });
  res.json({ ok: true });
}));

router.get('/project/:slug', (req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  res.json(listSkills(path.join(decodedPath, '.claude', 'skills')));
});

module.exports = router;
