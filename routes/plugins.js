const express = require('express');
const path = require('path');
const { readJson } = require('../lib/file-helpers');
const { PLUGINS_DIR } = require('../lib/paths');

const router = express.Router();

router.get('/', (req, res) => {
  const blocklist = readJson(path.join(PLUGINS_DIR, 'blocklist.json'), { plugins: [] });
  const marketplaces = readJson(path.join(PLUGINS_DIR, 'known_marketplaces.json'), {});
  res.json({ blocklist: blocklist.plugins || [], marketplaces });
});

module.exports = router;
