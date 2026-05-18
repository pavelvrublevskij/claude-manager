const fs = require('fs');
const path = require('path');
const { safeSlug } = require('./file-helpers');

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const LAUNCH_GRACE_MS = 30 * 1000;

const registry = new Map();
const pendingNew = new Map();

const keyOf = (slug, sessionId) => `${slug}|${sessionId}`;

function now() { return Date.now(); }

function register(slug, sessionId, via) {
  if (!slug || !sessionId) return;
  registry.set(keyOf(slug, sessionId), { slug, sessionId, launchedAt: now(), via });
}

function registerPendingNew(slug) {
  if (!slug) return;
  const list = pendingNew.get(slug) || [];
  list.push({ launchedAt: now() });
  pendingNew.set(slug, list);
}

function resolvePendingNew(slug, sessions) {
  const pendings = pendingNew.get(slug);
  if (!pendings || !pendings.length) return;
  const remaining = [];
  for (const p of pendings) {
    const windowEnd = p.launchedAt + LAUNCH_GRACE_MS;
    let matched = false;
    for (const s of sessions) {
      if (!s.created) continue;
      const created = new Date(s.created).getTime();
      if (Number.isNaN(created)) continue;
      if (created >= p.launchedAt && created <= windowEnd) {
        register(slug, s.sessionId, 'os-terminal');
        matched = true;
        break;
      }
    }
    if (!matched && now() - p.launchedAt < LAUNCH_GRACE_MS) {
      remaining.push(p);
    }
  }
  if (remaining.length) pendingNew.set(slug, remaining);
  else pendingNew.delete(slug);
}

function unregister(slug, sessionId) {
  registry.delete(keyOf(slug, sessionId));
}

function isActive(slug, sessionId, modifiedIso) {
  const entry = registry.get(keyOf(slug, sessionId));
  if (!entry) return false;
  const nowMs = now();
  if (nowMs - entry.launchedAt < ACTIVE_THRESHOLD_MS) return true;
  if (!modifiedIso) {
    registry.delete(keyOf(slug, sessionId));
    return false;
  }
  const modified = new Date(modifiedIso).getTime();
  if (Number.isNaN(modified) || nowMs - modified >= ACTIVE_THRESHOLD_MS) {
    registry.delete(keyOf(slug, sessionId));
    return false;
  }
  return true;
}

function isActiveByFile(slug, sessionId) {
  const entry = registry.get(keyOf(slug, sessionId));
  if (!entry) return false;
  const nowMs = now();
  if (nowMs - entry.launchedAt < ACTIVE_THRESHOLD_MS) return true;
  const dir = safeSlug(slug);
  if (!dir) {
    registry.delete(keyOf(slug, sessionId));
    return false;
  }
  try {
    const stat = fs.statSync(path.join(dir, sessionId + '.jsonl'));
    if (nowMs - stat.mtimeMs < ACTIVE_THRESHOLD_MS) return true;
  } catch (_) { /* unreadable */ }
  registry.delete(keyOf(slug, sessionId));
  return false;
}

function listActive() {
  const out = [];
  for (const entry of registry.values()) {
    if (isActiveByFile(entry.slug, entry.sessionId)) {
      out.push({ slug: entry.slug, sessionId: entry.sessionId, via: entry.via });
    }
  }
  return out;
}

function _reset() {
  registry.clear();
  pendingNew.clear();
}

function _backdate(slug, sessionId, launchedAt) {
  const entry = registry.get(keyOf(slug, sessionId));
  if (entry) entry.launchedAt = launchedAt;
}

module.exports = {
  register,
  registerPendingNew,
  resolvePendingNew,
  unregister,
  isActive,
  isActiveByFile,
  listActive,
  _reset,
  _backdate,
  ACTIVE_THRESHOLD_MS,
  LAUNCH_GRACE_MS
};
