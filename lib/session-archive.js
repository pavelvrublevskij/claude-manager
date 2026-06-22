const fs = require('fs');
const path = require('path');

function archivePath(projectDir) {
  return path.join(projectDir, 'archived-sessions.json');
}

function getArchivedIds(projectDir) {
  try {
    return new Set(JSON.parse(fs.readFileSync(archivePath(projectDir), 'utf8')));
  } catch {
    return new Set();
  }
}

function saveArchivedIds(projectDir, ids) {
  fs.writeFileSync(archivePath(projectDir), JSON.stringify([...ids]));
}

function archiveSession(projectDir, sessionId) {
  const ids = getArchivedIds(projectDir);
  ids.add(sessionId);
  saveArchivedIds(projectDir, ids);
}

function unarchiveSession(projectDir, sessionId) {
  const ids = getArchivedIds(projectDir);
  ids.delete(sessionId);
  saveArchivedIds(projectDir, ids);
}

module.exports = { getArchivedIds, archiveSession, unarchiveSession };
