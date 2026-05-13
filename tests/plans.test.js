const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

const PLANS_DIR = path.join(paths.CLAUDE_DIR, 'plans');

before(() => {
  fs.mkdirSync(PLANS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PLANS_DIR, 'sprint-plan.md'), '# Sprint Plan\n\nDo the thing.');
  fs.writeFileSync(path.join(PLANS_DIR, 'backlog.md'), '# Backlog\n\n- item 1\n- item 2');
});

test('GET /api/plans returns array with name and mtime fields', async () => {
  const res = await request(app).get('/api/plans');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const plan = res.body.find(p => p.name === 'sprint-plan');
  assert.ok(plan, 'seeded plan must appear');
  assert.strictEqual(typeof plan.name, 'string');
  assert.ok(plan.mtime, 'mtime must be present');
});

test('GET /api/plans returns all seeded plans', async () => {
  const res = await request(app).get('/api/plans');
  assert.strictEqual(res.status, 200);
  const names = res.body.map(p => p.name);
  assert.ok(names.includes('sprint-plan'));
  assert.ok(names.includes('backlog'));
});

test('GET /api/plans/:name returns plan content', async () => {
  const res = await request(app).get('/api/plans/sprint-plan');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'sprint-plan');
  assert.ok(res.body.content.includes('Sprint Plan'), 'content must include heading');
  assert.ok(res.body.mtime, 'mtime must be present');
});

test('GET /api/plans/:name returns 404 for missing plan', async () => {
  const res = await request(app).get('/api/plans/nonexistent-plan');
  assert.strictEqual(res.status, 404);
});

test('GET /api/plans/:name rejects path traversal', async () => {
  const res = await request(app).get('/api/plans/..bad');
  assert.strictEqual(res.status, 400);
});
