const path = require('path');
const fs = require('fs');
const { PROJECTS_DIR, BACKUPS_DIR, CLAUDE_DIR, DATA_DIR } = require('./paths');

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

/** Guard: ensure a write target is inside DATA_DIR, never inside CLAUDE_DIR. */
function safeDataWrite(filePath) {
  const resolved = path.resolve(filePath);
  if (resolved.startsWith(path.resolve(CLAUDE_DIR))) {
    throw new Error('Write to ~/.claude/ is not allowed from data operations');
  }
  if (!resolved.startsWith(path.resolve(DATA_DIR))) {
    throw new Error('Write target must be inside the data/ directory');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return resolved;
}

/** Write JSON to a safe data path (never ~/.claude/). */
function writeDataJson(filePath, data) {
  const safe = safeDataWrite(filePath);
  fs.writeFileSync(safe, JSON.stringify(data, null, 2));
}

module.exports = { backup, readJson, safeSlug, safeMemoryFile, wrapRoute, safeDataWrite, writeDataJson };
