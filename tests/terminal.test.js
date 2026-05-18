const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

const SLUG = 'terminal-test-proj';
const SESSION_ID = '99999999-9999-9999-9999-999999999999';
const PROJECT_DIR = path.join(paths.PROJECTS_DIR, SLUG);

before(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PROJECT_DIR, SESSION_ID + '.jsonl'),
    JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-01-01T00:00:00Z', message: { content: 'hi' } }) + '\n',
    'utf-8'
  );
});

test('GET /api/projects/:slug/terminal/info without sessionId returns 200 for valid slug', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/terminal/info`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof res.body.available, 'boolean');
  assert.strictEqual(res.body.sessionId, '');
  assert.ok(typeof res.body.projectPath === 'string' && res.body.projectPath.length > 0);
});

test('GET /api/projects/:slug/terminal/info with valid sessionId returns 200', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/terminal/info`).query({ sessionId: SESSION_ID });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.sessionId, SESSION_ID);
});

test('GET /api/projects/:slug/terminal/info rejects invalid slug', async () => {
  const res = await request(app).get('/api/projects/bad..slug/terminal/info');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid slug');
});

test('GET /api/projects/:slug/terminal/info rejects sessionId with traversal', async () => {
  const res = await request(app)
    .get(`/api/projects/${SLUG}/terminal/info`)
    .query({ sessionId: '..evil' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid session ID');
});

test('GET /api/projects/:slug/terminal/info returns 404 for unknown sessionId', async () => {
  const res = await request(app)
    .get(`/api/projects/${SLUG}/terminal/info`)
    .query({ sessionId: '00000000-0000-0000-0000-000000000000' });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Session not found');
});

test('validateTerminal: rejects empty slug, accepts valid combinations', () => {
  const { validateTerminal } = require('../lib/terminal-server');

  const noSlug = validateTerminal('', '');
  assert.strictEqual(noSlug.ok, false);
  assert.strictEqual(noSlug.status, 400);

  const badSlug = validateTerminal('a/b', '');
  assert.strictEqual(badSlug.ok, false);
  assert.strictEqual(badSlug.status, 400);

  const okNoSession = validateTerminal(SLUG, '');
  assert.strictEqual(okNoSession.ok, true);
  assert.strictEqual(okNoSession.sessionId, '');

  const okWithSession = validateTerminal(SLUG, SESSION_ID);
  assert.strictEqual(okWithSession.ok, true);
  assert.strictEqual(okWithSession.sessionId, SESSION_ID);
});

test('disconnectFor / hasActiveTerminal are no-ops when nothing is registered', () => {
  const { disconnectFor, hasActiveTerminal } = require('../lib/terminal-server');
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_ID), false);
  assert.strictEqual(disconnectFor(SLUG, SESSION_ID, 'reason'), false);
  // empty sessionId is never registered (each empty-session terminal spawns a fresh claude session)
  assert.strictEqual(hasActiveTerminal(SLUG, ''), false);
  assert.strictEqual(disconnectFor(SLUG, '', 'reason'), false);
});

test('getActiveTerminals / isAttached: empty when nothing registered', () => {
  const { getActiveTerminals, isAttached, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  assert.deepStrictEqual(getActiveTerminals(), []);
  assert.strictEqual(isAttached(SLUG, SESSION_ID), false);
});

test('detached entry: hasActiveTerminal=true but isAttached=false', () => {
  const { hasActiveTerminal, isAttached, getActiveTerminals, _injectFakeEntry, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  _injectFakeEntry(SLUG, SESSION_ID, { ws: null, detachedAt: Date.now() });
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_ID), true);
  assert.strictEqual(isAttached(SLUG, SESSION_ID), false);
  const list = getActiveTerminals();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].sessionId, SESSION_ID);
  assert.strictEqual(list[0].attached, false);
  _clearAll();
});

test('attached entry: isAttached=true', () => {
  const { isAttached, getActiveTerminals, _injectFakeEntry, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  _injectFakeEntry(SLUG, SESSION_ID, { ws: { readyState: 1 } });
  assert.strictEqual(isAttached(SLUG, SESSION_ID), true);
  assert.strictEqual(getActiveTerminals()[0].attached, true);
  _clearAll();
});

test('disconnectFor terminates the entry and removes it from the registry', () => {
  const { disconnectFor, hasActiveTerminal, _injectFakeEntry, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  let killed = false;
  _injectFakeEntry(SLUG, SESSION_ID, { term: { kill() { killed = true; }, pid: process.pid } });
  assert.strictEqual(disconnectFor(SLUG, SESSION_ID, 'bye'), true);
  assert.strictEqual(killed, true);
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_ID), false);
});

test('gcSweep removes entries whose pty PID is dead', () => {
  const { gcSweep, hasActiveTerminal, _injectFakeEntry, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  // PID 0 is special on Windows and POSIX; process.kill(0, 0) on POSIX targets the process group
  // (rejected as permission/usable). To force "dead pid", use a very high number that cannot exist.
  const deadPid = 2 ** 31 - 1;
  _injectFakeEntry(SLUG, SESSION_ID, { term: { kill() {}, pid: deadPid } });
  gcSweep();
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_ID), false);
});

test('gcSweep removes already-terminated entries', () => {
  const { gcSweep, hasActiveTerminal, _injectFakeEntry, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  _injectFakeEntry(SLUG, SESSION_ID, { terminated: true });
  gcSweep();
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_ID), false);
});

test('_bindSessionId re-keys a temp entry under the discovered sessionId', () => {
  const { hasActiveTerminal, _injectFakeEntry, _bindSessionId, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  // Inject as a "real" entry then mutate it to simulate a temp-keyed new-session entry.
  const entry = _injectFakeEntry(SLUG, SESSION_ID, { sessionId: '', key: `${SLUG}|@new-test` });
  // Move it under a temp key in the map to mirror the production code path.
  // _injectFakeEntry placed it under activeKey(slug, SESSION_ID), so remove that placement first.
  const ts = require('../lib/terminal-server');
  ts._clearAll();
  // Build a fresh fake entry under temp key manually by reusing _injectFakeEntry's shape:
  // injection requires sessionId, so we put a placeholder, then have _bindSessionId reroute it.
  // Use a placeholder sessionId for keying, then verify rebinding to a NEW id succeeds when no entry exists under the new key.
  const TEMP_SESSION = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const REAL_SESSION = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const placeholder = _injectFakeEntry(SLUG, TEMP_SESSION);
  // Simulate the temp-key state: clear sessionId on the entry (it's just discovered to be unknown)
  placeholder.sessionId = '';
  _bindSessionId(placeholder, REAL_SESSION);
  assert.strictEqual(hasActiveTerminal(SLUG, REAL_SESSION), true);
  // The placeholder key is now stale; _bindSessionId removed it.
  assert.strictEqual(hasActiveTerminal(SLUG, TEMP_SESSION), false);
  _clearAll();
});

test('_bindSessionId is a no-op when entry already has a sessionId', () => {
  const { hasActiveTerminal, _injectFakeEntry, _bindSessionId, _clearAll } = require('../lib/terminal-server');
  _clearAll();
  const SESSION_X = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const SESSION_Y = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const entry = _injectFakeEntry(SLUG, SESSION_X);
  _bindSessionId(entry, SESSION_Y);
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_X), true);
  assert.strictEqual(hasActiveTerminal(SLUG, SESSION_Y), false);
  _clearAll();
});
