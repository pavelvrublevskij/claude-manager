const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { app, paths } = require('./helpers/app');

const SLUG = 'memory-test-proj';
const PROJECT_DIR = path.join(paths.PROJECTS_DIR, SLUG);
const MEMORY_DIR = path.join(PROJECT_DIR, 'memory');

function writeMemory(filename, data, body) {
  const fm = `---\nname: ${data.name}\ndescription: ${data.description}\ntype: ${data.type}\n---\n${body}\n`;
  fs.writeFileSync(path.join(MEMORY_DIR, filename), fm, 'utf-8');
}

before(() => {
  fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  writeMemory('sample.md', { name: 'Sample', description: 'test memory', type: 'user' }, 'Body text');
  writeMemory('other.md', { name: 'Other', description: 'second memory', type: 'project' }, 'Other body');
});

test('GET /api/projects/:slug/memory lists memories with parsed frontmatter', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/memory`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.strictEqual(res.body.length, 2);
  const sample = res.body.find(m => m.filename === 'sample.md');
  assert.ok(sample);
  assert.strictEqual(sample.name, 'Sample');
  assert.strictEqual(sample.description, 'test memory');
  assert.strictEqual(sample.type, 'user');
  assert.strictEqual(sample.content, 'Body text');
});

test('GET /api/projects/:slug/memory returns [] when no memory dir', async () => {
  const emptySlug = 'memory-test-empty';
  fs.rmSync(path.join(paths.PROJECTS_DIR, emptySlug), { recursive: true, force: true });
  fs.mkdirSync(path.join(paths.PROJECTS_DIR, emptySlug), { recursive: true });
  const res = await request(app).get(`/api/projects/${emptySlug}/memory`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/projects/:slug/memory/:file returns memory details', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/memory/sample.md`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.filename, 'sample.md');
  assert.strictEqual(res.body.name, 'Sample');
  assert.strictEqual(res.body.description, 'test memory');
  assert.strictEqual(res.body.type, 'user');
  assert.strictEqual(res.body.content, 'Body text');
  assert.ok(typeof res.body.raw === 'string');
  assert.match(res.body.raw, /---/);
});

test('GET /api/projects/:slug/memory/:file 404 when missing', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/memory/nope.md`);
  assert.strictEqual(res.status, 404);
});

test('PUT /api/projects/:slug/memory/:file updates content and frontmatter', async () => {
  const put = await request(app)
    .put(`/api/projects/${SLUG}/memory/sample.md`)
    .send({ name: 'Updated', description: 'new desc', type: 'project', content: 'New body' });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const get = await request(app).get(`/api/projects/${SLUG}/memory/sample.md`);
  assert.strictEqual(get.body.name, 'Updated');
  assert.strictEqual(get.body.description, 'new desc');
  assert.strictEqual(get.body.type, 'project');
  assert.strictEqual(get.body.content, 'New body');
});

test('PUT /api/projects/:slug/memory/:file 404 when missing', async () => {
  const res = await request(app)
    .put(`/api/projects/${SLUG}/memory/nope.md`)
    .send({ name: 'X', description: 'Y', type: 'user', content: 'Z' });
  assert.strictEqual(res.status, 404);
});

test('POST /api/projects/:slug/memory creates a new memory', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory`)
    .send({ filename: 'fresh.md', name: 'Fresh', description: 'brand new', type: 'user', content: 'Hello' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);

  const get = await request(app).get(`/api/projects/${SLUG}/memory/fresh.md`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.name, 'Fresh');
  assert.strictEqual(get.body.content, 'Hello');
});

test('POST /api/projects/:slug/memory 409 on duplicate', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory`)
    .send({ filename: 'fresh.md', name: 'Again', description: 'dup', type: 'user', content: 'x' });
  assert.strictEqual(res.status, 409);
});

test('POST /api/projects/:slug/memory 400 on invalid filename', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory`)
    .send({ filename: 'bad.txt', name: 'x', description: 'x', type: 'user', content: 'x' });
  assert.strictEqual(res.status, 400);
});

test('DELETE /api/projects/:slug/memory/:file removes memory', async () => {
  fs.writeFileSync(path.join(MEMORY_DIR, 'to-delete.md'), '---\nname: D\n---\nbye\n', 'utf-8');
  const del = await request(app).delete(`/api/projects/${SLUG}/memory/to-delete.md`);
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.ok, true);
  assert.strictEqual(fs.existsSync(path.join(MEMORY_DIR, 'to-delete.md')), false);
});

test('DELETE /api/projects/:slug/memory/:file 404 when missing', async () => {
  const res = await request(app).delete(`/api/projects/${SLUG}/memory/ghost.md`);
  assert.strictEqual(res.status, 404);
});

test('Invalid slug rejected with 400', async () => {
  const res = await request(app).get(`/api/projects/..%2Fevil/memory`);
  assert.strictEqual(res.status, 400);
});

test('Invalid filename (no .md) rejected with 400', async () => {
  const res = await request(app).get(`/api/projects/${SLUG}/memory/bad.txt`);
  assert.strictEqual(res.status, 400);
});

test('Invalid filename (path traversal) rejected with 400', async () => {
  const res = await request(app).delete(`/api/projects/${SLUG}/memory/..%2Fescape.md`);
  assert.strictEqual(res.status, 400);
});

test('GET /api/projects/:slug/memory-index returns empty when missing', async () => {
  const idxSlug = 'memory-test-idx';
  fs.rmSync(path.join(paths.PROJECTS_DIR, idxSlug), { recursive: true, force: true });
  fs.mkdirSync(path.join(paths.PROJECTS_DIR, idxSlug, 'memory'), { recursive: true });
  const res = await request(app).get(`/api/projects/${idxSlug}/memory-index`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.content, '');
});

test('PUT then GET /api/projects/:slug/memory-index round-trips content', async () => {
  const put = await request(app)
    .put(`/api/projects/${SLUG}/memory-index`)
    .send({ content: '# Index\nSome notes' });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const get = await request(app).get(`/api/projects/${SLUG}/memory-index`);
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.content, '# Index\nSome notes');
});

test('GET /api/projects/:slug/memory-export returns ZIP with correct headers', async () => {
  const res = await request(app)
    .get(`/api/projects/${SLUG}/memory-export`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /application\/zip/);
  assert.match(res.headers['content-disposition'], /attachment; filename=/);
  assert.ok(parseInt(res.headers['x-file-count'], 10) >= 1);

  const zip = new AdmZip(res.body);
  const entries = zip.getEntries().map(e => e.entryName);
  assert.ok(entries.includes('sample.md'));
});

test('GET /api/projects/:slug/memory-export 404 when no memory files', async () => {
  const noneSlug = 'memory-test-none';
  fs.rmSync(path.join(paths.PROJECTS_DIR, noneSlug), { recursive: true, force: true });
  fs.mkdirSync(path.join(paths.PROJECTS_DIR, noneSlug), { recursive: true });
  const res = await request(app).get(`/api/projects/${noneSlug}/memory-export`);
  assert.strictEqual(res.status, 404);
});

test('POST /api/projects/:slug/memory-import writes files from zip', async () => {
  const importSlug = 'memory-test-import';
  fs.rmSync(path.join(paths.PROJECTS_DIR, importSlug), { recursive: true, force: true });
  fs.mkdirSync(path.join(paths.PROJECTS_DIR, importSlug), { recursive: true });

  const zip = new AdmZip();
  zip.addFile('imported.md', Buffer.from('---\nname: Imported\ntype: user\n---\nbody\n'));
  zip.addFile('another.md', Buffer.from('---\nname: Another\ntype: user\n---\nbody2\n'));
  const buf = zip.toBuffer();

  const res = await request(app)
    .post(`/api/projects/${importSlug}/memory-import`)
    .set('Content-Type', 'application/zip')
    .send(buf);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.imported, 2);

  assert.ok(fs.existsSync(path.join(paths.PROJECTS_DIR, importSlug, 'memory', 'imported.md')));
  assert.ok(fs.existsSync(path.join(paths.PROJECTS_DIR, importSlug, 'memory', 'another.md')));
});

test('POST /api/projects/:slug/memory-import 409 on conflict without overwrite', async () => {
  const zip = new AdmZip();
  zip.addFile('sample.md', Buffer.from('---\nname: Clash\ntype: user\n---\nnew\n'));
  const buf = zip.toBuffer();

  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory-import`)
    .set('Content-Type', 'application/zip')
    .send(buf);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.error, 'conflict');
  assert.ok(Array.isArray(res.body.conflicts));
  assert.ok(res.body.conflicts.includes('sample.md'));
});

test('POST /api/projects/:slug/memory-import with ?overwrite=1 replaces files', async () => {
  const zip = new AdmZip();
  zip.addFile('sample.md', Buffer.from('---\nname: Overwritten\ntype: user\n---\noverbody\n'));
  const buf = zip.toBuffer();

  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory-import?overwrite=1`)
    .set('Content-Type', 'application/zip')
    .send(buf);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);

  const get = await request(app).get(`/api/projects/${SLUG}/memory/sample.md`);
  assert.strictEqual(get.body.name, 'Overwritten');
  assert.strictEqual(get.body.content, 'overbody');
});

test('POST /api/projects/:slug/memory-import 400 on empty body', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory-import`)
    .set('Content-Type', 'application/zip')
    .send(Buffer.alloc(0));
  assert.strictEqual(res.status, 400);
});

test('POST /api/projects/:slug/memory-import 400 on invalid ZIP', async () => {
  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory-import`)
    .set('Content-Type', 'application/zip')
    .send(Buffer.from('not a zip file'));
  assert.strictEqual(res.status, 400);
});

test('POST /api/projects/:slug/memory-import 400 when zip has no .md entries', async () => {
  const zip = new AdmZip();
  zip.addFile('notes.txt', Buffer.from('not markdown'));
  const buf = zip.toBuffer();

  const res = await request(app)
    .post(`/api/projects/${SLUG}/memory-import`)
    .set('Content-Type', 'application/zip')
    .send(buf);
  assert.strictEqual(res.status, 400);
});
