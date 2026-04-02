const path = require('path');
const fs = require('fs');
const { PROJECTS_DIR, BACKUPS_DIR } = require('./paths');

/** Create a timestamped backup of a file before modifying it. */
function backup(filePath) {
  if (!fs.existsSync(filePath)) return;
  const name = path.basename(filePath);
  const dest = path.join(BACKUPS_DIR, `${name}.${Date.now()}.bak`);
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  fs.copyFileSync(filePath, dest);
}

/** Read and parse a JSON file, returning fallback on any error. */
function readJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch (_) { return fallback; }
}

/** Validate a project slug and return its full path under PROJECTS_DIR, or null if unsafe. */
function safeSlug(slug) {
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return null;
  const dir = path.join(PROJECTS_DIR, slug);
  if (!dir.startsWith(PROJECTS_DIR)) return null;
  return dir;
}

/** Validate a memory filename (must be .md, no path traversal). */
function safeMemoryFile(filename) {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  if (!filename.endsWith('.md')) return null;
  return filename;
}

/** Wrap an async route handler with standard error handling. */
function wrapRoute(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status(500).json({ error: e.message }); }
  };
}

module.exports = { backup, readJson, safeSlug, safeMemoryFile, wrapRoute };
