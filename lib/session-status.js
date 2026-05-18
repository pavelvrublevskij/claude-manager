const terminalServer = require('./terminal-server');
const activeSessions = require('./active-sessions');

function getActiveKind(slug, sessionId, modifiedIso) {
  if (terminalServer.hasActiveTerminal(slug, sessionId)) return 'browser';
  if (activeSessions.isActive(slug, sessionId, modifiedIso)) return 'os';
  return null;
}

function stampActive(slug, sessions) {
  if (slug) {
    activeSessions.resolvePendingNew(slug, sessions);
  } else {
    const bySlug = new Map();
    for (const s of sessions) {
      const k = s.slug;
      if (!k) continue;
      if (!bySlug.has(k)) bySlug.set(k, []);
      bySlug.get(k).push(s);
    }
    for (const [s, list] of bySlug) activeSessions.resolvePendingNew(s, list);
  }
  for (const s of sessions) {
    const kind = getActiveKind(s.slug || slug, s.sessionId, s.modified);
    s.active = !!kind;
    s.activeKind = kind;
  }
}

function listAllActiveSessions() {
  const seen = new Set();
  const result = [];
  for (const t of terminalServer.getActiveTerminals()) {
    if (!t.sessionId) continue;
    const key = `${t.slug}|${t.sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ slug: t.slug, sessionId: t.sessionId, kind: 'browser' });
  }
  for (const e of activeSessions.listActive()) {
    const key = `${e.slug}|${e.sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ slug: e.slug, sessionId: e.sessionId, kind: 'os' });
  }
  return result;
}

module.exports = { getActiveKind, stampActive, listAllActiveSessions };
