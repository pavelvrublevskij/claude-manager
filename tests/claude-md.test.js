const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths, HOME } = require('./helpers/app');

function pathToSlug(p) {
  let s = p;
  const winMatch = s.match(/^([A-Za-z]):[\\/]/);
  if (winMatch) {
    s = winMatch[1] + '--' + s.slice(3);
  } else if (s.startsWith('/')) {
    s = s.slice(1);
  }
  return s.replace(/[\\/]/g, '-').replace(/\./g, '-');
}

test('GET /api/claude-md/global returns global CLAUDE.md content', async () => {
  const res = await request(app).get('/api/claude-md/global');
  assert.strictEqual(res.status, 200);
  assert.ok('content' in res.body);
  assert.ok(res.body.content.includes('Global CLAUDE.md fixture'));
});

test('PUT /api/claude-md/global writes content and GET reflects it', async () => {
  const body = { content: '# Updated global\n\nnew body' };
  const putRes = await request(app)
    .put('/api/claude-md/global')
    .set('Content-Type', 'application/json')
    .send(body);
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);

  const onDisk = fs.readFileSync(paths.GLOBAL_CLAUDE_MD, 'utf-8');
  assert.strictEqual(onDisk, body.content);

  const getRes = await request(app).get('/api/claude-md/global');
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.content, body.content);
});

test('GET /api/claude-md/global returns 404 when file missing', async () => {
  fs.unlinkSync(paths.GLOBAL_CLAUDE_MD);
  const res = await request(app).get('/api/claude-md/global');
  assert.strictEqual(res.status, 404);
  assert.ok(res.body.error);
  fs.writeFileSync(paths.GLOBAL_CLAUDE_MD, '# Global CLAUDE.md fixture\n\nSample content for tests.\n', 'utf-8');
});

test('GET /api/claude-md/project/:slug returns project CLAUDE.md content', async () => {
  const projDir = path.join(HOME, 'claudemdproj');
  fs.mkdirSync(path.join(projDir, '.claude'), { recursive: true });
  const content = '# Project CLAUDE.md\n\nproject specific';
  fs.writeFileSync(path.join(projDir, '.claude', 'CLAUDE.md'), content, 'utf-8');

  const slug = pathToSlug(projDir);
  const res = await request(app).get(`/api/claude-md/project/${slug}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.content, content);
  assert.ok(res.body.path.endsWith(path.join('.claude', 'CLAUDE.md')));
});

test('PUT /api/claude-md/project/:slug writes project CLAUDE.md and GET reflects it', async () => {
  const projDir = path.join(HOME, 'claudemdproj2');
  fs.mkdirSync(path.join(projDir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(projDir, '.claude', 'CLAUDE.md'), 'initial', 'utf-8');

  const slug = pathToSlug(projDir);
  const putRes = await request(app)
    .put(`/api/claude-md/project/${slug}`)
    .set('Content-Type', 'application/json')
    .send({ content: 'updated project content' });
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.body.ok, true);

  const onDisk = fs.readFileSync(path.join(projDir, '.claude', 'CLAUDE.md'), 'utf-8');
  assert.strictEqual(onDisk, 'updated project content');

  const getRes = await request(app).get(`/api/claude-md/project/${slug}`);
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.content, 'updated project content');
});

test('GET /api/claude-md/project/:slug returns 404 for missing project CLAUDE.md', async () => {
  const projDir = path.join(HOME, 'claudemdmissing');
  fs.mkdirSync(projDir, { recursive: true });

  const slug = pathToSlug(projDir);
  const res = await request(app).get(`/api/claude-md/project/${slug}`);
  assert.strictEqual(res.status, 404);
  assert.ok(res.body.error);
  assert.ok('path' in res.body);
});
