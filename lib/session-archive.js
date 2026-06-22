const fs = require('fs');
const { DATA_DIR } = require('./paths');
const path = require('path');

const ARCHIVE_FILE = path.join(DATA_DIR, 'archived-sessions.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8')); }
  catch { return {}; }
}

function writeAll(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(data));
}

function getArchivedIds(slug) {
  const all = readAll();
  return new Set(all[slug] || []);
}

function archiveSession(slug, sessionId) {
  const all = readAll();
  const ids = new Set(all[slug] || []);
  ids.add(sessionId);
  all[slug] = [...ids];
  writeAll(all);
}

function unarchiveSession(slug, sessionId) {
  const all = readAll();
  const ids = new Set(all[slug] || []);
  ids.delete(sessionId);
  all[slug] = [...ids];
  writeAll(all);
}

module.exports = { getArchivedIds, archiveSession, unarchiveSession };
