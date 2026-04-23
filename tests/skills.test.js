const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const request = require('supertest');
const { app, HOME, paths } = require('./helpers/app');

const PROJECT_NAME = 'skills-test-proj';
const PROJECT_ROOT = path.join(HOME, PROJECT_NAME);
const PROJECT_SKILLS_DIR = path.join(PROJECT_ROOT, '.claude', 'skills');

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
  fs.rmSync(path.join(paths.SKILLS_DIR), { recursive: true, force: true });
  fs.mkdirSync(paths.SKILLS_DIR, { recursive: true });
  const seedDir = path.join(paths.SKILLS_DIR, 'seed-global-skill');
  fs.mkdirSync(seedDir, { recursive: true });
  fs.writeFileSync(
    path.join(seedDir, 'SKILL.md'),
    '---\nname: seed-global-skill\ndescription: Seeded global\n---\nGlobal body'
  );

  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_SKILLS_DIR, { recursive: true });
  const seedProj = path.join(PROJECT_SKILLS_DIR, 'seed-proj-skill');
  fs.mkdirSync(seedProj, { recursive: true });
  fs.writeFileSync(
    path.join(seedProj, 'SKILL.md'),
    '---\nname: seed-proj-skill\ndescription: Seeded project\n---\nProj body'
  );
});

after(() => {
  fs.rmSync(PROJECT_ROOT, { recursive: true, force: true });
});

test('GET /api/skills/global returns seeded global skill with frontmatter', async () => {
  const res = await request(app).get('/api/skills/global');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const seed = res.body.find(s => s.name === 'seed-global-skill');
  assert.ok(seed, 'seeded global skill not present');
  assert.strictEqual(seed.title, 'seed-global-skill');
  assert.strictEqual(seed.description, 'Seeded global');
  assert.strictEqual(seed.frontmatter.name, 'seed-global-skill');
  assert.strictEqual(seed.content, 'Global body');
});

test('GET /api/skills/global/:name returns 404 for missing skill', async () => {
  const res = await request(app).get('/api/skills/global/does-not-exist-xyz');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'Not found');
});

test('GET /api/skills/global/:name returns parsed frontmatter', async () => {
  const res = await request(app).get('/api/skills/global/seed-global-skill');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'seed-global-skill');
  assert.strictEqual(res.body.frontmatter.name, 'seed-global-skill');
  assert.strictEqual(res.body.frontmatter.description, 'Seeded global');
  assert.strictEqual(res.body.content, 'Global body');
  assert.ok(typeof res.body.raw === 'string');
});

test('PUT /api/skills/global/:name creates a new skill', async () => {
  const name = 'created-global-skill';
  const payload = {
    frontmatter: { name, description: 'Created via PUT' },
    content: 'Created content'
  };
  const put = await request(app).put(`/api/skills/global/${name}`).send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const get = await request(app).get(`/api/skills/global/${name}`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.frontmatter.description, 'Created via PUT');
  assert.strictEqual(get.body.content, 'Created content');

  const skillFile = path.join(paths.SKILLS_DIR, name, 'SKILL.md');
  assert.ok(fs.existsSync(skillFile));
});

test('PUT /api/skills/global/:name updates an existing skill', async () => {
  const name = 'update-global-skill';
  await request(app).put(`/api/skills/global/${name}`).send({
    frontmatter: { name, description: 'v1' }, content: 'first'
  });
  const put = await request(app).put(`/api/skills/global/${name}`).send({
    frontmatter: { name, description: 'v2' }, content: 'second'
  });
  assert.strictEqual(put.status, 200);

  const get = await request(app).get(`/api/skills/global/${name}`);
  assert.strictEqual(get.body.frontmatter.description, 'v2');
  assert.strictEqual(get.body.content, 'second');
});

test('DELETE /api/skills/global/:name removes the skill', async () => {
  const name = 'delete-global-skill';
  await request(app).put(`/api/skills/global/${name}`).send({
    frontmatter: { name, description: 'tbd' }, content: 'tbd'
  });

  const del = await request(app).delete(`/api/skills/global/${name}`);
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.ok, true);

  const after = await request(app).get(`/api/skills/global/${name}`);
  assert.strictEqual(after.status, 404);
});

test('DELETE /api/skills/global/:name returns 404 if skill missing', async () => {
  const res = await request(app).delete('/api/skills/global/never-existed');
  assert.strictEqual(res.status, 404);
});

test('GET /api/skills/project/:slug lists project skills', async () => {
  const res = await request(app).get(`/api/skills/project/${SLUG}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const seed = res.body.find(s => s.name === 'seed-proj-skill');
  assert.ok(seed);
  assert.strictEqual(seed.description, 'Seeded project');
  assert.strictEqual(seed.content, 'Proj body');
});

test('GET /api/skills/project/:slug returns [] for unknown project', async () => {
  const bogus = buildSlug(path.join(HOME, 'no-such-project-here'));
  const res = await request(app).get(`/api/skills/project/${bogus}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/skills/project/:slug/:name returns 404 when missing', async () => {
  const res = await request(app).get(`/api/skills/project/${SLUG}/not-there`);
  assert.strictEqual(res.status, 404);
});

test('GET /api/skills/project/:slug/:name returns parsed frontmatter', async () => {
  const res = await request(app).get(`/api/skills/project/${SLUG}/seed-proj-skill`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'seed-proj-skill');
  assert.strictEqual(res.body.frontmatter.description, 'Seeded project');
  assert.strictEqual(res.body.content, 'Proj body');
});

test('PUT/GET/DELETE /api/skills/project/:slug/:name roundtrip', async () => {
  const name = 'added-proj-skill';
  const put = await request(app).put(`/api/skills/project/${SLUG}/${name}`).send({
    frontmatter: { name, description: 'proj added' }, content: 'proj content'
  });
  assert.strictEqual(put.status, 200);

  const get = await request(app).get(`/api/skills/project/${SLUG}/${name}`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.frontmatter.description, 'proj added');
  assert.strictEqual(get.body.content, 'proj content');

  const onDisk = path.join(PROJECT_SKILLS_DIR, name, 'SKILL.md');
  assert.ok(fs.existsSync(onDisk));

  const del = await request(app).delete(`/api/skills/project/${SLUG}/${name}`);
  assert.strictEqual(del.status, 200);

  const after = await request(app).get(`/api/skills/project/${SLUG}/${name}`);
  assert.strictEqual(after.status, 404);
});

test('DELETE /api/skills/project/:slug/:name returns 404 when missing', async () => {
  const res = await request(app).delete(`/api/skills/project/${SLUG}/never-there`);
  assert.strictEqual(res.status, 404);
});
