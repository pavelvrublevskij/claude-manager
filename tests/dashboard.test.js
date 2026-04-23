const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, paths } = require('./helpers/app');

before(() => {
  fs.mkdirSync(paths.PROJECTS_DIR, { recursive: true });
});

test('GET /api/dashboard returns stats and recentSessions on empty HOME', async () => {
  const res = await request(app).get('/api/dashboard');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.stats, 'stats present');
  assert.ok(Array.isArray(res.body.recentSessions), 'recentSessions array');
  const s = res.body.stats;
  assert.strictEqual(typeof s.projects, 'number');
  assert.strictEqual(typeof s.sessions, 'number');
  assert.strictEqual(typeof s.memoryFiles, 'number');
  assert.strictEqual(typeof s.mcpServers, 'number');
  assert.strictEqual(typeof s.skills, 'number');
  assert.strictEqual(typeof s.outputStyles, 'number');
  assert.strictEqual(typeof s.keybindings, 'number');
});

test('GET /api/dashboard picks up seeded project and session fallback', async () => {
  const slug = 'dash-proj-beta';
  const projDir = path.join(paths.PROJECTS_DIR, slug);
  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(path.join(projDir, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(projDir, 'memory', 'x.md'), '# X');
  const jsonl = JSON.stringify({ type: 'user', message: { content: 'hello world' }, timestamp: new Date().toISOString() });
  fs.writeFileSync(path.join(projDir, 'sess-xyz.jsonl'), jsonl + '\n');

  const res = await request(app).get('/api/dashboard');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.stats.projects >= 1);
  assert.ok(res.body.stats.memoryFiles >= 1);
  assert.ok(res.body.stats.sessions >= 1);
  const recent = res.body.recentSessions.find(r => r.sessionId === 'sess-xyz');
  assert.ok(recent, 'recent session should include seeded session');
  assert.strictEqual(recent.slug, slug);
  assert.strictEqual(recent.messageCount, 1);
});
