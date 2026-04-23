const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const request = require('supertest');
const { app, HOME, paths } = require('./helpers/app');

const PROJECT_NAME = 'styles-test-proj';
const PROJECT_ROOT = path.join(HOME, PROJECT_NAME);
const PROJECT_STYLES_DIR = path.join(PROJECT_ROOT, '.claude', 'output-styles');

function buildSlug(fullPath) {
  if (process.platform === 'win32') {
    const drive = fullPath[0];
    const rest = fullPath.substring(3).split(path.sep).join('-');
    return drive + '--' + rest;
  }
  return fullPath.replace(/^\//, '').split('/').join('-');
}

const SLUG = buildSlug(PROJECT_ROOT);

before(() => {
  fs.rmSync(paths.OUTPUT_STYLES_DIR, { recursive: true, force: true });
  fs.mkdirSync(paths.OUTPUT_STYLES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(paths.OUTPUT_STYLES_DIR, 'seed-global.md'),
    '---\nname: seed-global\ndescription: Seed global style\n---\nGlobal style body'
  );

  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_STYLES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PROJECT_STYLES_DIR, 'seed-proj.md'),
    '---\nname: seed-proj\ndescription: Seed project style\n---\nProj style body'
  );
});

after(() => {
  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
});

test('GET /api/output-styles/global lists seeded style', async () => {
  const res = await request(app).get('/api/output-styles/global');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const seed = res.body.find(s => s.filename === 'seed-global.md');
  assert.ok(seed);
  assert.strictEqual(seed.name, 'seed-global');
  assert.strictEqual(seed.description, 'Seed global style');
  assert.strictEqual(seed.content, 'Global style body');
});

test('PUT /api/output-styles/global/:filename creates a style', async () => {
  const filename = 'created-global.md';
  const put = await request(app).put(`/api/output-styles/global/${filename}`).send({
    frontmatter: { name: 'created-global', description: 'New' },
    content: 'created body'
  });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const list = await request(app).get('/api/output-styles/global');
  const found = list.body.find(s => s.filename === filename);
  assert.ok(found);
  assert.strictEqual(found.description, 'New');
  assert.strictEqual(found.content, 'created body');

  assert.ok(fs.existsSync(path.join(paths.OUTPUT_STYLES_DIR, filename)));
});

test('PUT /api/output-styles/global/:filename updates existing style', async () => {
  const filename = 'update-global.md';
  await request(app).put(`/api/output-styles/global/${filename}`).send({
    frontmatter: { name: 'update-global', description: 'v1' }, content: 'first'
  });
  const put2 = await request(app).put(`/api/output-styles/global/${filename}`).send({
    frontmatter: { name: 'update-global', description: 'v2' }, content: 'second'
  });
  assert.strictEqual(put2.status, 200);

  const list = await request(app).get('/api/output-styles/global');
  const found = list.body.find(s => s.filename === filename);
  assert.strictEqual(found.description, 'v2');
  assert.strictEqual(found.content, 'second');
});

test('DELETE /api/output-styles/global/:filename removes the style', async () => {
  const filename = 'delete-global.md';
  await request(app).put(`/api/output-styles/global/${filename}`).send({
    frontmatter: { name: 'delete-global', description: 'tbd' }, content: 'tbd'
  });

  const del = await request(app).delete(`/api/output-styles/global/${filename}`);
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.ok, true);

  const list = await request(app).get('/api/output-styles/global');
  assert.ok(!list.body.find(s => s.filename === filename));
});

test('DELETE /api/output-styles/global/:filename returns 404 when missing', async () => {
  const res = await request(app).delete('/api/output-styles/global/never-existed.md');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Not found');
});

test('GET /api/output-styles/project/:slug lists project styles', async () => {
  const res = await request(app).get(`/api/output-styles/project/${SLUG}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const seed = res.body.find(s => s.filename === 'seed-proj.md');
  assert.ok(seed);
  assert.strictEqual(seed.description, 'Seed project style');
  assert.strictEqual(seed.content, 'Proj style body');
});

test('GET /api/output-styles/project/:slug returns [] for unknown project', async () => {
  const bogus = buildSlug(path.join(HOME, 'no-styles-project'));
  const res = await request(app).get(`/api/output-styles/project/${bogus}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/output-styles/project/:slug/:filename returns 404 when missing', async () => {
  const res = await request(app).get(`/api/output-styles/project/${SLUG}/nope.md`);
  assert.strictEqual(res.status, 404);
});

test('GET /api/output-styles/project/:slug/:filename returns parsed frontmatter', async () => {
  const res = await request(app).get(`/api/output-styles/project/${SLUG}/seed-proj.md`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.filename, 'seed-proj.md');
  assert.strictEqual(res.body.frontmatter.name, 'seed-proj');
  assert.strictEqual(res.body.frontmatter.description, 'Seed project style');
  assert.strictEqual(res.body.content, 'Proj style body');
  assert.ok(typeof res.body.raw === 'string');
});

test('PUT/GET/DELETE /api/output-styles/project/:slug/:filename roundtrip', async () => {
  const filename = 'added-proj.md';
  const put = await request(app).put(`/api/output-styles/project/${SLUG}/${filename}`).send({
    frontmatter: { name: 'added-proj', description: 'proj added' },
    content: 'proj added body'
  });
  assert.strictEqual(put.status, 200);

  const get = await request(app).get(`/api/output-styles/project/${SLUG}/${filename}`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.frontmatter.description, 'proj added');
  assert.strictEqual(get.body.content, 'proj added body');

  assert.ok(fs.existsSync(path.join(PROJECT_STYLES_DIR, filename)));

  const del = await request(app).delete(`/api/output-styles/project/${SLUG}/${filename}`);
  assert.strictEqual(del.status, 200);

  const after = await request(app).get(`/api/output-styles/project/${SLUG}/${filename}`);
  assert.strictEqual(after.status, 404);
});

test('DELETE /api/output-styles/project/:slug/:filename returns 404 when missing', async () => {
  const res = await request(app).delete(`/api/output-styles/project/${SLUG}/never.md`);
  assert.strictEqual(res.status, 404);
});
