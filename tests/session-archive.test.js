const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

const SLUG = 'archive-test-proj';
const SESSION_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SESSION_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const PROJECT_DIR = path.join(paths.PROJECTS_DIR, SLUG);
const ARCHIVE_FILE = path.join(PROJECT_DIR, 'archived-sessions.json');

function writeJsonl(filePath, entries) {
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

before(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });

  const userEntry = (id, ts, msg) => ({
    type: 'user', uuid: id, parentUuid: null,
    timestamp: ts, gitBranch: 'main',
    message: { content: msg }
  });

  writeJsonl(path.join(PROJECT_DIR, SESSION_A + '.jsonl'), [
    userEntry('a1', '2026-01-01T10:00:00.000Z', 'Session A content about alpha'),
  ]);
  writeJsonl(path.join(PROJECT_DIR, SESSION_B + '.jsonl'), [
    userEntry('b1', '2026-02-01T10:00:00.000Z', 'Session B content about beta'),
  ]);
  writeJsonl(path.join(PROJECT_DIR, SESSION_C + '.jsonl'), [
    userEntry('c1', '2026-03-01T10:00:00.000Z', 'Session C content about gamma'),
  ]);
});

after(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

test('GET /sessions returns all non-archived sessions by default', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(ids.includes(SESSION_A));
  assert.ok(ids.includes(SESSION_B));
  assert.ok(ids.includes(SESSION_C));
});

test('POST /archive marks session as archived', async () => {
  const res = await request(app).post(`/api/projects/${SLUG}/sessions/${SESSION_A}/archive`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const archived = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8'));
  assert.ok(archived.includes(SESSION_A));
});

test('GET /sessions excludes archived session', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(!ids.includes(SESSION_A));
  assert.ok(ids.includes(SESSION_B));
  assert.ok(ids.includes(SESSION_C));
});

test('GET /sessions?archived=true returns only archived session', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions?archived=true`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(ids.includes(SESSION_A));
  assert.ok(!ids.includes(SESSION_B));
  assert.ok(!ids.includes(SESSION_C));
});

test('GET /sessions/search excludes archived session', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/search?q=alpha`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(!ids.includes(SESSION_A));
});

test('GET /sessions/search includes non-archived sessions', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/search?q=beta`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(ids.includes(SESSION_B));
});

test('POST /unarchive restores session', async () => {
  const res = await request(app).post(`/api/projects/${SLUG}/sessions/${SESSION_A}/unarchive`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const archived = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8'));
  assert.ok(!archived.includes(SESSION_A));
});

test('GET /sessions includes unarchived session again', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  const ids = res.body.map(s => s.sessionId);
  assert.ok(ids.includes(SESSION_A));
});

test('POST /archive returns 404 for non-existent session', async () => {
  const res = await request(app).post(`/api/projects/${SLUG}/sessions/nonexistent-id/archive`);
  assert.strictEqual(res.status, 404);
});

test('POST /archive rejects path traversal', async () => {
  const res = await request(app).post(`/api/projects/${SLUG}/sessions/..%2Fevil/archive`);
  assert.strictEqual(res.status, 400);
});
