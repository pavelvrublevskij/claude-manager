const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, HOME } = require('./helpers/app');

function pathToSlug(p) {
  const winMatch = p.match(/^([A-Za-z]):[\\\/](.*)$/);
  if (winMatch) {
    return winMatch[1] + '--' + winMatch[2].replace(/[\\\/]/g, '-').replace(/\./g, '-');
  }
  return p.replace(/^\//, '').replace(/\//g, '-').replace(/\./g, '-');
}

test('GET /api/project-settings/:slug returns empty objects for unknown slug', async () => {
  const res = await request(app).get('/api/project-settings/ps-nonexistent-slug-xyz');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.local, {});
  assert.deepStrictEqual(res.body.shared, {});
  assert.ok(res.body.localPath);
  assert.ok(res.body.sharedPath);
});

test('PUT /api/project-settings/:slug/shared writes settings.json then GET reflects it', async () => {
  const projectDir = path.join(HOME, 'ps-proj-a');
  fs.mkdirSync(projectDir, { recursive: true });
  const slug = pathToSlug(projectDir);

  const payload = { permissions: { allow: ['Bash(ls:*)'] } };
  const put = await request(app).put(`/api/project-settings/${slug}/shared`).send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const fileOnDisk = path.join(projectDir, '.claude', 'settings.json');
  assert.ok(fs.existsSync(fileOnDisk));
  const parsed = JSON.parse(fs.readFileSync(fileOnDisk, 'utf-8'));
  assert.deepStrictEqual(parsed, payload);

  const get = await request(app).get(`/api/project-settings/${slug}`);
  assert.strictEqual(get.status, 200);
  assert.deepStrictEqual(get.body.shared, payload);
  assert.deepStrictEqual(get.body.local, {});
});

test('PUT /api/project-settings/:slug/local writes settings.local.json', async () => {
  const projectDir = path.join(HOME, 'ps-proj-b');
  fs.mkdirSync(projectDir, { recursive: true });
  const slug = pathToSlug(projectDir);

  const payload = { env: { DEBUG: 'true' } };
  const put = await request(app).put(`/api/project-settings/${slug}/local`).send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const fileOnDisk = path.join(projectDir, '.claude', 'settings.local.json');
  assert.ok(fs.existsSync(fileOnDisk));
  const parsed = JSON.parse(fs.readFileSync(fileOnDisk, 'utf-8'));
  assert.deepStrictEqual(parsed, payload);

  const get = await request(app).get(`/api/project-settings/${slug}`);
  assert.deepStrictEqual(get.body.local, payload);
});

test('PUT /api/project-settings/:slug/shared creates .claude dir if missing', async () => {
  const projectDir = path.join(HOME, 'ps-proj-c');
  fs.mkdirSync(projectDir, { recursive: true });
  const slug = pathToSlug(projectDir);
  assert.ok(!fs.existsSync(path.join(projectDir, '.claude')));

  const put = await request(app).put(`/api/project-settings/${slug}/shared`).send({ a: 1 });
  assert.strictEqual(put.status, 200);
  assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'settings.json')));
});
