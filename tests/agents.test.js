const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const request = require('supertest');
const { app, HOME } = require('./helpers/app');

const PROJECT_NAME = 'agents-test-proj';
const PROJECT_ROOT = path.join(HOME, PROJECT_NAME);
const AGENTS_DIR = path.join(PROJECT_ROOT, '.claude', 'agents');

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
  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(AGENTS_DIR, 'seed-agent.md'),
    '---\nname: seed-agent\ndescription: Seed agent\n---\nAgent body'
  );
});

after(() => {
  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
});

test('GET /api/agents/project/:slug lists seeded agent with frontmatter', async () => {
  const res = await request(app).get(`/api/agents/project/${SLUG}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const seed = res.body.find(a => a.filename === 'seed-agent.md');
  assert.ok(seed);
  assert.strictEqual(seed.name, 'seed-agent');
  assert.strictEqual(seed.description, 'Seed agent');
  assert.strictEqual(seed.content, 'Agent body');
});

test('GET /api/agents/project/:slug returns [] for unknown project path', async () => {
  const bogus = buildSlug(path.join(HOME, 'no-agents-project'));
  const res = await request(app).get(`/api/agents/project/${bogus}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/agents/project/:slug/:filename returns 404 when missing', async () => {
  const res = await request(app).get(`/api/agents/project/${SLUG}/missing.md`);
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Not found');
});

test('GET /api/agents/project/:slug/:filename returns parsed frontmatter', async () => {
  const res = await request(app).get(`/api/agents/project/${SLUG}/seed-agent.md`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.filename, 'seed-agent.md');
  assert.strictEqual(res.body.frontmatter.name, 'seed-agent');
  assert.strictEqual(res.body.frontmatter.description, 'Seed agent');
  assert.strictEqual(res.body.content, 'Agent body');
  assert.ok(typeof res.body.raw === 'string');
});

test('PUT /api/agents/project/:slug/:filename creates a new agent', async () => {
  const filename = 'created-agent.md';
  const put = await request(app).put(`/api/agents/project/${SLUG}/${filename}`).send({
    frontmatter: { name: 'created-agent', description: 'New' },
    content: 'new agent body'
  });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const get = await request(app).get(`/api/agents/project/${SLUG}/${filename}`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.frontmatter.description, 'New');
  assert.strictEqual(get.body.content, 'new agent body');

  assert.ok(fs.existsSync(path.join(AGENTS_DIR, filename)));
});

test('PUT /api/agents/project/:slug/:filename updates existing agent', async () => {
  const filename = 'update-agent.md';
  await request(app).put(`/api/agents/project/${SLUG}/${filename}`).send({
    frontmatter: { name: 'update-agent', description: 'v1' }, content: 'first'
  });
  const put2 = await request(app).put(`/api/agents/project/${SLUG}/${filename}`).send({
    frontmatter: { name: 'update-agent', description: 'v2' }, content: 'second'
  });
  assert.strictEqual(put2.status, 200);

  const get = await request(app).get(`/api/agents/project/${SLUG}/${filename}`);
  assert.strictEqual(get.body.frontmatter.description, 'v2');
  assert.strictEqual(get.body.content, 'second');
});

test('DELETE /api/agents/project/:slug/:filename removes the agent', async () => {
  const filename = 'delete-agent.md';
  await request(app).put(`/api/agents/project/${SLUG}/${filename}`).send({
    frontmatter: { name: 'delete-agent', description: 'tbd' }, content: 'tbd'
  });

  const del = await request(app).delete(`/api/agents/project/${SLUG}/${filename}`);
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.ok, true);

  const after = await request(app).get(`/api/agents/project/${SLUG}/${filename}`);
  assert.strictEqual(after.status, 404);
});

test('DELETE /api/agents/project/:slug/:filename returns 404 when missing', async () => {
  const res = await request(app).delete(`/api/agents/project/${SLUG}/never.md`);
  assert.strictEqual(res.status, 404);
});
