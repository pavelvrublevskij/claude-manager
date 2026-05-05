const express = require('express');
const { wrapRoute } = require('../lib/file-helpers');
const { validateTerminal, ptyAvailable } = require('../lib/terminal-server');

const router = express.Router({ mergeParams: true });

router.get('/:slug/terminal/info', wrapRoute((req, res) => {
  const sessionId = (req.query.sessionId || '').toString();
  const result = validateTerminal(req.params.slug, sessionId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({
    available: ptyAvailable(),
    projectPath: result.projectPath,
    sessionId: result.sessionId
  });
}));

module.exports = router;
