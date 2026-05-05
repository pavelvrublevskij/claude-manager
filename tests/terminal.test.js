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
