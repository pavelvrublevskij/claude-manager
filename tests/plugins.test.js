const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('./helpers/app');

test('GET /api/plugins returns blocklist and marketplaces from fixtures', async () => {
  const res = await request(app).get('/api/plugins');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.blocklist));
  assert.deepStrictEqual(res.body.blocklist, ['evil-plugin', 'bad-plugin']);
  assert.ok(res.body.marketplaces);
  assert.strictEqual(typeof res.body.marketplaces, 'object');
  assert.ok(res.body.marketplaces.official);
  assert.strictEqual(res.body.marketplaces.official.name, 'Official Marketplace');
});
