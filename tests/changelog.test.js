const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('./helpers/app');

test('GET /api/changelog returns changelog content', async () => {
  const res = await request(app).get('/api/changelog');
  assert.strictEqual(res.status, 200);
  assert.ok('content' in res.body);
  assert.strictEqual(typeof res.body.content, 'string');
  assert.ok(res.body.content.length > 0);
});
