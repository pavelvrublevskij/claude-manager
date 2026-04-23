const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

test('GET /api/settings returns settings.json content', async () => {
  const res = await request(app).get('/api/settings');
  assert.strictEqual(res.status, 200);
  assert.ok('content' in res.body);
  assert.strictEqual(typeof res.body.content, 'string');
  const parsed = JSON.parse(res.body.content);
  assert.strictEqual(parsed.theme, 'dark');
  assert.deepStrictEqual(parsed.permissions.allow, ['Bash(ls:*)']);
});

test('PUT /api/settings writes new content and GET reflects it', async () => {
  const newContent = JSON.stringify({ theme: 'light', permissions: { allow: ['Bash(echo:*)'] } }, null, 2);
  const putRes = await request(app)
    .put('/api/settings')
    .set('Content-Type', 'application/json')
    .send({ content: newContent });
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);

  const onDisk = fs.readFileSync(paths.SETTINGS_FILE, 'utf-8');
  assert.strictEqual(onDisk, newContent);

  const getRes = await request(app).get('/api/settings');
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.content, newContent);
});

test('PUT /api/settings with invalid JSON returns 500', async () => {
  const res = await request(app)
    .put('/api/settings')
    .set('Content-Type', 'application/json')
    .send({ content: '{ not valid json' });
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.error);
});
