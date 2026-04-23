const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('./helpers/app');

test('Unknown GET route serves SPA index.html', async () => {
  const res = await request(app).get('/some/unknown/route');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /<!DOCTYPE html>/i);
});

test('Static asset /js/utils.js is served', async () => {
  const res = await request(app).get('/js/utils.js');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
});
