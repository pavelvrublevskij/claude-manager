const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, paths } = require('./helpers/app');

const DATA_FILES = ['pricing-history.json'];
const snapshots = {};

before(() => {
  for (const f of DATA_FILES) {
    const p = path.join(paths.DATA_DIR, f);
    if (fs.existsSync(p)) snapshots[f] = fs.readFileSync(p);
  }
});

process.on('exit', () => {
  for (const f of DATA_FILES) {
    const p = path.join(paths.DATA_DIR, f);
    if (snapshots[f] !== undefined) fs.writeFileSync(p, snapshots[f]);
  }
});

test('GET /api/pricing returns current pricing and source metadata', async () => {
  const res = await request(app).get('/api/pricing');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.current, 'current present');
  assert.strictEqual(typeof res.body.current, 'object');
  assert.ok('lastFetched' in res.body);
  assert.strictEqual(typeof res.body.source, 'string');
  assert.strictEqual(typeof res.body.historyCount, 'number');
});

test('GET /api/pricing/history returns an array of entries', async () => {
  const res = await request(app).get('/api/pricing/history');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('GET /api/pricing/config returns a url string', async () => {
  const res = await request(app).get('/api/pricing/config');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof res.body.url, 'string');
  assert.ok(res.body.url.length > 0);
});

test('PUT /api/pricing/config writes a url, GET returns it', async () => {
  const url = 'https://example.invalid/pricing-test-' + Date.now();
  const putRes = await request(app).put('/api/pricing/config').send({ url });
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);
  const getRes = await request(app).get('/api/pricing/config');
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.url, url);
});

test('PUT /api/pricing/config rejects invalid url', async () => {
  const res = await request(app).put('/api/pricing/config').send({ url: null });
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.error);
});

test('POST /api/pricing/manual adds a history entry', async () => {
  const before = await request(app).get('/api/pricing/history');
  const beforeCount = before.body.length;
  const fetchedAt = '2000-01-01T00:00:00.000Z';
  const models = {
    'claude-test-model-1': { input: 1.23, output: 4.56, cache_write: 1.5, cache_read: 0.1 }
  };
  const res = await request(app).post('/api/pricing/manual').send({ models, fetchedAt });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const after = await request(app).get('/api/pricing/history');
  assert.strictEqual(after.status, 200);
  assert.ok(after.body.length >= beforeCount + 1);
  const added = after.body.find(e => e.models && e.models['claude-test-model-1']);
  assert.ok(added, 'manual entry visible in history');
  assert.strictEqual(added.source, 'manual');
});

test('POST /api/pricing/manual rejects empty body', async () => {
  const res = await request(app).post('/api/pricing/manual').send({});
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error);
});

test('PUT /api/pricing/history/:index updates an existing entry', async () => {
  const addRes = await request(app).post('/api/pricing/manual').send({
    models: { 'claude-put-target': { input: 1, output: 2, cache_write: 1, cache_read: 0.1 } },
    fetchedAt: '2000-01-02T00:00:00.000Z'
  });
  assert.strictEqual(addRes.status, 200);
  const list = await request(app).get('/api/pricing/history');
  const idx = list.body.findIndex(e => e.models && e.models['claude-put-target']);
  assert.ok(idx >= 0, 'target entry exists');

  const updated = {
    'claude-put-target': { input: 9, output: 99, cache_write: 9, cache_read: 0.9 }
  };
  const putRes = await request(app).put('/api/pricing/history/' + idx).send({ models: updated });
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);

  const after = await request(app).get('/api/pricing/history');
  const replaced = after.body.find(e => e.models && e.models['claude-put-target']);
  assert.ok(replaced);
  assert.strictEqual(replaced.models['claude-put-target'].input, 9);
  assert.strictEqual(replaced.source, 'manual');
});

test('PUT /api/pricing/history/:index rejects out-of-range index', async () => {
  const res = await request(app).put('/api/pricing/history/99999').send({
    models: { 'x-bad': { input: 1, output: 1, cache_write: 1, cache_read: 0.1 } }
  });
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.error);
});

test('POST /api/pricing/fetch SKIPPED: hits Anthropic pricing page over the network', { skip: true }, () => {});
