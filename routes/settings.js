const express = require('express');
const fs = require('fs');
const { backup, wrapRoute } = require('../lib/file-helpers');
const { SETTINGS_FILE } = require('../lib/paths');

const router = express.Router();

router.get('/', wrapRoute((req, res) => {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    res.json({ content: data });
  } catch (e) {
    res.status(404).json({ error: 'settings.json not found' });
  }
}));

router.put('/', wrapRoute((req, res) => {
  const { content } = req.body;
  JSON.parse(content); // validate
  backup(SETTINGS_FILE);
  fs.writeFileSync(SETTINGS_FILE, content, 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
