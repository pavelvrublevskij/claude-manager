const cache = new Map();

module.exports = {
  get(sessionId) { return cache.get(sessionId); },
  set(sessionId, hasPlan) { cache.set(sessionId, !!hasPlan); },
  _clear() { cache.clear(); }
};
