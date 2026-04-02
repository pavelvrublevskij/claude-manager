const express = require('express');
const fs = require('fs');
const { backup, readJson, wrapRoute } = require('../lib/file-helpers');
const { KEYBINDINGS_FILE } = require('../lib/paths');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(readJson(KEYBINDINGS_FILE, { bindings: [] }));
});

router.put('/', wrapRoute((req, res) => {
  backup(KEYBINDINGS_FILE);
  fs.writeFileSync(KEYBINDINGS_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
