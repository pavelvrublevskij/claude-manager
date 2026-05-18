const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { paths } = require('./helpers/app');

const SLUG = 'active-sessions-test-proj';
const SESSION_A = '44444444-4444-4444-4444-444444444444';
const SESSION_B = '55555555-5555-5555-5555-555555555555';
const PROJECT_DIR = path.join(paths.PROJECTS_DIR, SLUG);

const activeSessions = require('../lib/active-sessions');
const { ACTIVE_THRESHOLD_MS, LAUNCH_GRACE_MS } = activeSessions;

before(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
});

beforeEach(() => activeSessions._reset());

test('a freshly registered session is active regardless of mtime', () => {
  activeSessions.register(SLUG, SESSION_A, 'os-terminal');
  const ancient = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, ancient), true);
});

test('an unregistered session is not active', () => {
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('after launchedAt expires, recent mtime keeps the session active', () => {
  activeSessions.register(SLUG, SESSION_A, 'os-terminal');
  activeSessions._backdate(SLUG, SESSION_A, Date.now() - (ACTIVE_THRESHOLD_MS + 1000));
  const justNow = new Date().toISOString();
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, justNow), true);
});

test('after launchedAt expires AND mtime is stale, the entry is pruned and inactive', () => {
  activeSessions.register(SLUG, SESSION_A, 'os-terminal');
  activeSessions._backdate(SLUG, SESSION_A, Date.now() - (ACTIVE_THRESHOLD_MS + 1000));
  const stale = new Date(Date.now() - (ACTIVE_THRESHOLD_MS + 1000)).toISOString();
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, stale), false);
  // Subsequent calls confirm the entry is gone (now even fresh mtime can't revive it)
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('isActive with no mtime + stale launchedAt prunes the entry', () => {
  activeSessions.register(SLUG, SESSION_A, 'os-terminal');
  activeSessions._backdate(SLUG, SESSION_A, Date.now() - (ACTIVE_THRESHOLD_MS + 1000));
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, null), false);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('registerPendingNew + resolvePendingNew promotes a session inside the grace window', () => {
  activeSessions.registerPendingNew(SLUG);
  const justNow = new Date().toISOString();
  activeSessions.resolvePendingNew(SLUG, [{ sessionId: SESSION_A, created: justNow }]);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, justNow), true);
});

test('resolvePendingNew ignores sessions created outside the grace window', () => {
  activeSessions.registerPendingNew(SLUG);
  const wayBack = new Date(Date.now() - (LAUNCH_GRACE_MS + 5000)).toISOString();
  activeSessions.resolvePendingNew(SLUG, [{ sessionId: SESSION_A, created: wayBack }]);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('resolvePendingNew drops stale pending entries even when no match is found', () => {
  activeSessions.registerPendingNew(SLUG);
  // First call: nothing matches, but the pending entry is fresh so it survives.
  activeSessions.resolvePendingNew(SLUG, []);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('unregister removes an entry', () => {
  activeSessions.register(SLUG, SESSION_A, 'browser-terminal');
  activeSessions.unregister(SLUG, SESSION_A);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, new Date().toISOString()), false);
});

test('register is a no-op for missing slug or sessionId', () => {
  activeSessions.register('', SESSION_A, 'os-terminal');
  activeSessions.register(SLUG, '', 'os-terminal');
  assert.strictEqual(activeSessions.isActive('', SESSION_A, new Date().toISOString()), false);
  assert.strictEqual(activeSessions.isActive(SLUG, '', new Date().toISOString()), false);
});

test('multiple sessions in one project can be active simultaneously', () => {
  activeSessions.register(SLUG, SESSION_A, 'os-terminal');
  activeSessions.register(SLUG, SESSION_B, 'browser-terminal');
  const iso = new Date().toISOString();
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_A, iso), true);
  assert.strictEqual(activeSessions.isActive(SLUG, SESSION_B, iso), true);
});
