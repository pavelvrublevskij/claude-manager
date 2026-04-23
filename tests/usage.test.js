const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, paths } = require('./helpers/app');

before(() => {
  fs.mkdirSync(paths.PROJECTS_DIR, { recursive: true });

  const slug = 'usage-proj-gamma';
  const projDir = path.join(paths.PROJECTS_DIR, slug);
  fs.mkdirSync(projDir, { recursive: true });
  const sessionId = 'sess-001';
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: '2026-03-01T12:00:00Z',
    message: {
      model: 'claude-sonnet-4-6',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      }
    }
  });
  fs.writeFileSync(path.join(projDir, sessionId + '.jsonl'), line + '\n');
});

test('GET /api/usage/summary returns aggregated shape', async () => {
  const res = await request(app).get('/api/usage/summary');
  assert.strictEqual(res.status, 200);
  const b = res.body;
  assert.ok(b.totals, 'totals present');
  assert.strictEqual(typeof b.totals.input_tokens, 'number');
  assert.strictEqual(typeof b.totals.output_tokens, 'number');
  assert.ok(b.byModel);
  assert.ok(b.cost);
  assert.strictEqual(typeof b.sessionCount, 'number');
  assert.strictEqual(typeof b.projectCount, 'number');
  assert.ok(Array.isArray(b.allModels));
  assert.ok(Array.isArray(b.allProjects));
  assert.ok(b.modelPricing);
  assert.ok('pricingSource' in b);
});

test('GET /api/usage/summary reflects seeded session tokens', async () => {
  const res = await request(app).get('/api/usage/summary');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.totals.input_tokens >= 100);
  assert.ok(res.body.totals.output_tokens >= 50);
  assert.ok(res.body.sessionCount >= 1);
  assert.ok(res.body.projectCount >= 1);
  assert.ok(res.body.byModel['claude-sonnet-4-6'], 'seeded model present');
});

test('GET /api/usage/by-period returns periods array', async () => {
  const res = await request(app).get('/api/usage/by-period?group=month');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.periods));
  if (res.body.periods.length) {
    const p = res.body.periods[0];
    assert.strictEqual(typeof p.label, 'string');
    assert.strictEqual(typeof p.input_tokens, 'number');
    assert.strictEqual(typeof p.cost, 'number');
  }
});

test('GET /api/usage/by-period?group=day groups by day', async () => {
  const res = await request(app).get('/api/usage/by-period?group=day');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.periods));
  const dayEntry = res.body.periods.find(p => p.label === '2026-03-01');
  assert.ok(dayEntry, 'day label from seeded session should exist');
});

test('GET /api/usage/by-project returns projects array', async () => {
  const res = await request(app).get('/api/usage/by-project');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.projects));
  const entry = res.body.projects.find(p => p.slug === 'usage-proj-gamma');
  assert.ok(entry, 'seeded project should appear');
  assert.strictEqual(typeof entry.sessionCount, 'number');
  assert.strictEqual(typeof entry.cost, 'number');
  assert.ok(entry.byModel);
});

test('GET /api/usage/project/:slug returns project totals', async () => {
  const res = await request(app).get('/api/usage/project/usage-proj-gamma');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.slug, 'usage-proj-gamma');
  assert.ok(res.body.totals);
  assert.ok(res.body.byModel);
  assert.ok(res.body.cost);
  assert.strictEqual(typeof res.body.sessionCount, 'number');
  assert.ok(res.body.sessionCount >= 1);
});

test('GET /api/usage/project/:slug for unknown slug returns zeroed totals', async () => {
  const res = await request(app).get('/api/usage/project/no-such-slug-xyz');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.slug, 'no-such-slug-xyz');
  assert.strictEqual(res.body.sessionCount, 0);
  assert.strictEqual(res.body.totals.input_tokens, 0);
  assert.strictEqual(res.body.totals.output_tokens, 0);
});
