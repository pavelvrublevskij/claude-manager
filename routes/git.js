const { execFile } = require('child_process');
const { Router } = require('express');
const { safeSlug, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');

const router = Router();

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trimEnd());
    });
  });
}

function parseStatus(porcelain) {
  return porcelain.split(/\r?\n/).filter(Boolean).map(line => {
    if (line.length < 4) return null;
    const xy = line.slice(0, 2);
    let file = line.slice(3);

    // git quotes paths with special chars/spaces — strip quotes and unescape
    if (file.startsWith('"') && file.endsWith('"')) {
      file = file.slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }

    // For renames take destination path after " -> "
    const arrowIdx = file.indexOf(' -> ');
    if (arrowIdx !== -1) file = file.slice(arrowIdx + 4);

    let label;
    if (xy === '??') label = 'untracked';
    else if (xy[0] === 'D' || xy[1] === 'D') label = 'deleted';
    else if (xy[0] === 'A') label = 'new';
    else label = 'modified';
    return { path: file, xy, label };
  }).filter(Boolean);
}

router.get('/:slug/git/info', wrapRoute(async (req, res) => {
  if (!safeSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid slug' });
  const projectPath = decodeSlug(req.params.slug);
  if (!projectPath) return res.json({ available: false });

  try {
    await git(['rev-parse', '--git-dir'], projectPath);
  } catch (_) {
    return res.json({ available: false });
  }

  let branch = null;
  try { branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath); } catch (_) {}

  let hasRemote = false;
  try { hasRemote = (await git(['remote'], projectPath)).length > 0; } catch (_) {}

  let files = [];
  try {
    const raw = await git(['status', '--porcelain'], projectPath);
    files = parseStatus(raw);
  } catch (_) {}

  res.json({ available: true, branch, hasRemote, files });
}));

router.post('/:slug/git/commit', wrapRoute(async (req, res) => {
  if (!safeSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid slug' });
  const { message, files } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Commit message required' });
  if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'No files selected' });
  const projectPath = decodeSlug(req.params.slug);
  if (!projectPath) return res.status(400).json({ error: 'Cannot resolve project path' });

  await git(['add', '--', ...files], projectPath);
  const output = await git(['commit', '-m', message.trim()], projectPath);
  res.json({ ok: true, output });
}));

router.post('/:slug/git/push', wrapRoute(async (req, res) => {
  if (!safeSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid slug' });
  const projectPath = decodeSlug(req.params.slug);
  if (!projectPath) return res.status(400).json({ error: 'Cannot resolve project path' });

  const output = await git(['push'], projectPath);
  res.json({ ok: true, output });
}));

module.exports = router;
