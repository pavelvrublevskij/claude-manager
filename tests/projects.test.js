const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, paths } = require('./helpers/app');

before(() => {
  fs.mkdirSync(paths.PROJECTS_DIR, { recursive: true });
  const slug = 'test-proj-alpha';
  const projDir = path.join(paths.PROJECTS_DIR, slug);
  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(path.join(projDir, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(projDir, 'memory', 'a.md'), '# A');
  fs.writeFileSync(path.join(projDir, 'memory', 'b.md'), '# B');
  fs.writeFileSync(path.join(projDir, 's1.jsonl'), '');
});

test('GET /api/projects returns an array', async () => {
  const res = await request(app).get('/api/projects');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('GET /api/projects includes seeded project with expected shape', async () => {
  const res = await request(app).get('/api/projects');
  assert.strictEqual(res.status, 200);
  const found = res.body.find(p => p.slug === 'test-proj-alpha');
  assert.ok(found, 'seeded project should appear');
  assert.strictEqual(found.memoryCount, 2);
  assert.strictEqual(found.hasMemory, true);
  assert.strictEqual(found.sessionCount, 1);
  assert.strictEqual(typeof found.path, 'string');
  assert.strictEqual(typeof found.skillsCount, 'number');
  assert.strictEqual(typeof found.outputStylesCount, 'number');
  assert.strictEqual(typeof found.hasClaudeMd, 'boolean');
  assert.strictEqual(typeof found.hasAiMemory, 'boolean');
});

test('POST /api/projects/:slug/open-folder SKIPPED: spawns a shell/explorer (side-effect)', { skip: true }, () => {});
