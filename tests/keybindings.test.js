const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const request = require('supertest');
const { app, paths } = require('./helpers/app');

test('GET /api/keybindings returns bindings object from fixture', async () => {
  const res = await request(app).get('/api/keybindings');
  assert.strictEqual(res.status, 200);
  assert.ok('keybindings' in res.body);
  assert.ok(Array.isArray(res.body.keybindings));
  assert.strictEqual(res.body.keybindings.length, 0);
});

test('PUT /api/keybindings writes body as JSON and GET reflects it', async () => {
  const payload = { keybindings: [{ key: 'ctrl+s', command: 'save' }] };
  const putRes = await request(app)
    .put('/api/keybindings')
    .set('Content-Type', 'application/json')
    .send(payload);
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);

  const onDisk = JSON.parse(fs.readFileSync(paths.KEYBINDINGS_FILE, 'utf-8'));
  assert.deepStrictEqual(onDisk, payload);

  const getRes = await request(app).get('/api/keybindings');
  assert.strictEqual(getRes.status, 200);
  assert.deepStrictEqual(getRes.body, payload);
});

test('GET /api/keybindings returns fallback when file is invalid JSON', async () => {
  fs.writeFileSync(paths.KEYBINDINGS_FILE, '{ not valid json', 'utf-8');
  const res = await request(app).get('/api/keybindings');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { bindings: [] });
});
