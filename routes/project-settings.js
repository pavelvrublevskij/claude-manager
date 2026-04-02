const express = require('express');
const fs = require('fs');
const path = require('path');
const { backup, readJson, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');

const router = express.Router();

router.get('/:slug', (req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const localFile = path.join(decodedPath, '.claude', 'settings.local.json');
  const sharedFile = path.join(decodedPath, '.claude', 'settings.json');
  res.json({
    local: readJson(localFile, {}),
    shared: readJson(sharedFile, {}),
    localPath: localFile,
    sharedPath: sharedFile
  });
});

router.put('/:slug/:type', wrapRoute((req, res) => {
  const decodedPath = decodeSlug(req.params.slug);
  const file = req.params.type === 'local'
    ? path.join(decodedPath, '.claude', 'settings.local.json')
    : path.join(decodedPath, '.claude', 'settings.json');
  fs.mkdirSync(path.join(decodedPath, '.claude'), { recursive: true });
  backup(file);
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
