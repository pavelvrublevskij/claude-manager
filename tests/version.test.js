const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('./helpers/app');
const pkg = require('../package.json');

test('GET /api/version returns local version and expected shape', async () => {
  const res = await request(app).get('/api/version');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.version, pkg.version);
  assert.ok('latest' in res.body);
  assert.ok('updateAvailable' in res.body);
  assert.ok('docker' in res.body);
  assert.strictEqual(typeof res.body.updateAvailable, 'boolean');
});
