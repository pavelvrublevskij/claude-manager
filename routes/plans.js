const express = require('express');
const fs = require('fs');
const path = require('path');
const { CLAUDE_DIR } = require('../lib/paths');
const { wrapRoute } = require('../lib/file-helpers');
const router = express.Router();
const PLANS_DIR = path.join(CLAUDE_DIR, 'plans');

function listPlans() {
  if (!fs.existsSync(PLANS_DIR)) return [];
  return fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const stat = fs.statSync(path.join(PLANS_DIR, f));
      return { name: f.replace(/\.md$/, ''), mtime: stat.mtime };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

router.get('/', wrapRoute((req, res) => {
  res.json(listPlans());
}));

router.get('/:name', wrapRoute((req, res) => {
  const name = req.params.name;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  const filePath = path.join(PLANS_DIR, name + '.md');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const content = fs.readFileSync(filePath, 'utf-8');
  const stat = fs.statSync(filePath);
  res.json({ name, content, mtime: stat.mtime });
}));

module.exports = router;
