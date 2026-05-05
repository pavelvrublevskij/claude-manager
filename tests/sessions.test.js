const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

const SLUG = 'sessions-test-proj';
const SESSION_A = '11111111-1111-1111-1111-111111111111';
const SESSION_B = '22222222-2222-2222-2222-222222222222';
const SESSION_C = '33333333-3333-3333-3333-333333333333';
const PROJECT_DIR = path.join(paths.PROJECTS_DIR, SLUG);

function writeJsonl(filePath, entries) {
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

before(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });

  writeJsonl(path.join(PROJECT_DIR, SESSION_A + '.jsonl'), [
    {
      type: 'user',
      uuid: 'u1',
      parentUuid: null,
      timestamp: '2026-01-01T10:00:00.000Z',
      gitBranch: 'main',
      message: { content: 'Hello from session A about widgets' }
    },
    {
      type: 'assistant',
      uuid: 'a1',
      parentUuid: 'u1',
      timestamp: '2026-01-01T10:00:05.000Z',
      message: { model: 'claude-3-5-sonnet', content: 'Hi, let me help with widgets.' }
    },
    {
      type: 'user',
      uuid: 'u2',
      parentUuid: 'a1',
      timestamp: '2026-01-01T10:00:10.000Z',
      gitBranch: 'main',
      message: { content: 'Second user message with unique-needle-alpha' }
    },
    {
      type: 'assistant',
      uuid: 'a2',
      parentUuid: 'u2',
      timestamp: '2026-01-01T10:00:15.000Z',
      message: { model: 'claude-3-5-sonnet', content: 'Responding to alpha.' }
    },
    {
      type: 'user',
      uuid: 'u3',
      parentUuid: 'a2',
      timestamp: '2026-01-01T10:00:20.000Z',
      gitBranch: 'main',
      message: { content: 'Third message' }
    }
  ]);

  writeJsonl(path.join(PROJECT_DIR, SESSION_C + '.jsonl'), [
    {
      type: 'user', uuid: 'c1', parentUuid: null,
      timestamp: '2026-03-01T08:00:00.000Z',
      gitBranch: 'main',
      message: { content: 'Start work on main' }
    },
    {
      type: 'user', uuid: 'c2', parentUuid: 'c1',
      timestamp: '2026-03-01T08:30:00.000Z',
      gitBranch: 'feature/x',
      message: { content: 'Switched to feature' }
    },
    {
      type: 'user', uuid: 'c3', parentUuid: 'c2',
      timestamp: '2026-03-01T09:00:00.000Z',
      gitBranch: 'main',
      message: { content: 'Back to main' }
    },
    {
      type: 'user', uuid: 'c4', parentUuid: 'c3',
      timestamp: '2026-03-01T09:30:00.000Z',
      gitBranch: 'bugfix/y',
      message: { content: 'Hotfix branch' }
    }
  ]);

  writeJsonl(path.join(PROJECT_DIR, SESSION_B + '.jsonl'), [
    {
      type: 'user',
      uuid: 'u10',
      parentUuid: null,
      timestamp: '2026-02-01T09:00:00.000Z',
      gitBranch: 'feature',
      message: { content: 'Session B first prompt about gadgets' }
    },
    {
      type: 'assistant',
      uuid: 'a10',
      parentUuid: 'u10',
      timestamp: '2026-02-01T09:00:05.000Z',
      message: { model: 'claude-3-5-sonnet', content: 'Gadget reply' }
    }
  ]);
});

test('GET /api/projects/:slug/sessions returns array with expected fields', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 3);
  const ids = res.body.map(s => s.sessionId).sort();
  assert.deepStrictEqual(ids, [SESSION_A, SESSION_B, SESSION_C].sort());
  const a = res.body.find(s => s.sessionId === SESSION_A);
  assert.strictEqual(a.messageCount, 3);
  assert.strictEqual(a.gitBranch, 'main');
  assert.ok(a.firstPrompt.includes('Hello from session A'));
  assert.ok('created' in a);
  assert.ok('modified' in a);
});

test('GET /api/projects/:slug/sessions sorts by modified descending', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body[0].sessionId, SESSION_C);
  assert.strictEqual(res.body[1].sessionId, SESSION_B);
  assert.strictEqual(res.body[2].sessionId, SESSION_A);
});

test('GET /api/projects/:slug/sessions includes ordered distinct gitBranches', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions`);
  assert.strictEqual(res.status, 200);
  const c = res.body.find(s => s.sessionId === SESSION_C);
  assert.ok(c, 'session C present');
  assert.deepStrictEqual(c.gitBranches, ['main', 'feature/x', 'bugfix/y'],
    'gitBranches should be distinct in first-seen order');
  const a = res.body.find(s => s.sessionId === SESSION_A);
  assert.deepStrictEqual(a.gitBranches, ['main']);
  const b = res.body.find(s => s.sessionId === SESSION_B);
  assert.deepStrictEqual(b.gitBranches, ['feature']);
});

test('GET /api/projects/:slug/sessions with invalid slug returns 400', async () => {
  const res = await request(app).get('/api/projects/bad..slug/sessions');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid slug');
});

test('GET /api/projects/:slug/sessions/search filters by query', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/search`).query({ q: 'unique-needle-alpha' });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.strictEqual(res.body.length, 1);
  assert.strictEqual(res.body[0].sessionId, SESSION_A);
  assert.ok(Array.isArray(res.body[0].snippets));
  assert.ok(res.body[0].snippets.length >= 1);
  assert.ok(res.body[0].snippets[0].text.toLowerCase().includes('unique-needle-alpha'));
});

test('GET /api/projects/:slug/sessions/search returns empty for short query', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/search`).query({ q: 'a' });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/projects/:slug/sessions/search returns empty when no match', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/search`).query({ q: 'zzznonexistentzzz' });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/projects/:slug/sessions/:sessionId returns paginated messages (default)', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/${SESSION_A}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.messages));
  assert.strictEqual(res.body.total, 5);
  assert.strictEqual(res.body.messages.length, 5);
  assert.strictEqual(res.body.hasMore, false);
  assert.strictEqual(res.body.messages[0].role, 'user');
  assert.strictEqual(res.body.messages[0].content[0].text, 'Third message');
});

test('GET /api/projects/:slug/sessions/:sessionId includes stats for badge rendering', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/${SESSION_A}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.stats, 'stats field should be present');
  // messageCount counts user messages only (prompts sent); total counts all rendered messages
  assert.strictEqual(res.body.stats.messageCount, 3);
  assert.strictEqual(res.body.total, 5);
  assert.deepStrictEqual(res.body.stats.gitBranches, ['main']);
  assert.strictEqual(res.body.stats.lastGitBranch, 'main');
  assert.strictEqual(res.body.stats.isSidechain, false);
});

test('GET /api/projects/:slug/sessions/:sessionId honors offset and limit', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/${SESSION_A}`).query({ offset: 1, limit: 2 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 5);
  assert.strictEqual(res.body.messages.length, 2);
  assert.strictEqual(res.body.hasMore, true);
});

test('GET /api/projects/:slug/sessions/:sessionId with unknown id returns 404', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/does-not-exist`);
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Session not found');
});

test('GET /api/projects/:slug/sessions/:sessionId rejects traversal in session id', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/sessions/..evil`);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid session ID');
});

test('POST /api/projects/:slug/sessions/:sessionId/rename updates custom title', async () => {
  const newTitle = 'Renamed Session Title';
  const res = await request(app)
    .post(`/api/projects/${SLUG}/sessions/${SESSION_B}/rename`)
    .send({ title: newTitle });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.title, newTitle);

  const list = await request(app).get(`/api/projects/${SLUG}/sessions`);
  const b = list.body.find(s => s.sessionId === SESSION_B);
  assert.strictEqual(b.summary, newTitle);
});

test('POST /api/projects/:slug/sessions/:sessionId/rename rejects empty title', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/sessions/${SESSION_A}/rename`)
    .send({ title: '   ' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Title is required');
});

test('POST /api/projects/:slug/sessions/:sessionId/rename rejects overly long title', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/sessions/${SESSION_A}/rename`)
    .send({ title: 'x'.repeat(501) });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Title too long');
});

test('POST /api/projects/:slug/sessions/:sessionId/rename returns 404 for unknown session', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/sessions/unknown-session/rename`)
    .send({ title: 'Whatever' });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Session not found');
});

test('POST /api/projects/:slug/sessions/new is skipped (spawns terminal)', { skip: 'Endpoint launches an OS terminal via child_process; testing would open a real window on the runner.' }, () => {});

test('POST /api/projects/:slug/sessions/:sessionId/resume is skipped (spawns terminal)', { skip: 'Endpoint launches an OS terminal via child_process; testing would open a real window on the runner.' }, () => {});
