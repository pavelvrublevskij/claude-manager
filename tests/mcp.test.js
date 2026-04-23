const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, HOME, paths } = require('./helpers/app');

function pathToSlug(p) {
  const winMatch = p.match(/^([A-Za-z]):[\\\/](.*)$/);
  if (winMatch) {
    return winMatch[1] + '--' + winMatch[2].replace(/[\\\/]/g, '-').replace(/\./g, '-');
  }
  return p.replace(/^\//, '').replace(/\//g, '-').replace(/\./g, '-');
}

test('GET /api/mcp/global returns servers from ~/.claude.json', async () => {
  const res = await request(app).get('/api/mcp/global');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.servers);
  assert.ok(res.body.servers['example-global']);
  assert.strictEqual(res.body.servers['example-global'].type, 'stdio');
});

test('GET /api/mcp/cloud returns history entries when no credentials file exists', async () => {
  const res = await request(app).get('/api/mcp/cloud');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const linear = res.body.find(e => e.provider === 'Linear');
  assert.ok(linear);
  assert.strictEqual(linear.source, 'history');
});

test('PUT /api/mcp/global writes servers and GET reflects it', async () => {
  const payload = {
    servers: {
      'mcp-test-srv': { type: 'stdio', command: 'node', args: ['x.js'] }
    }
  };
  const put = await request(app).put('/api/mcp/global').send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const get = await request(app).get('/api/mcp/global');
  assert.ok(get.body.servers['mcp-test-srv']);
  assert.strictEqual(get.body.servers['mcp-test-srv'].command, 'node');

  const raw = JSON.parse(fs.readFileSync(paths.CLAUDE_JSON, 'utf-8'));
  assert.ok(raw.mcpServers['mcp-test-srv']);
});

test('GET /api/mcp/project/:slug returns fallback shape for unknown slug', async () => {
  const res = await request(app).get('/api/mcp/project/mcp-nonexistent-slug-xyz');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.projectScope);
  assert.deepStrictEqual(res.body.projectScope.servers, {});
  assert.ok(res.body.localScope);
  assert.deepStrictEqual(res.body.localScope.servers, {});
});

test('PUT /api/mcp/project/:slug/project writes .mcp.json into decoded project dir', async () => {
  const projectDir = path.join(HOME, 'mcp-proj-a');
  fs.mkdirSync(projectDir, { recursive: true });
  const slug = pathToSlug(projectDir);

  const payload = { servers: { 'mcp-proj-srv': { type: 'stdio', command: 'ls' } } };
  const put = await request(app).put(`/api/mcp/project/${slug}/project`).send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);

  const fileOnDisk = path.join(projectDir, '.mcp.json');
  assert.ok(fs.existsSync(fileOnDisk));
  const parsed = JSON.parse(fs.readFileSync(fileOnDisk, 'utf-8'));
  assert.ok(parsed.mcpServers['mcp-proj-srv']);

  const get = await request(app).get(`/api/mcp/project/${slug}`);
  assert.strictEqual(get.status, 200);
  assert.ok(get.body.projectScope.servers['mcp-proj-srv']);
});

test('PUT /api/mcp/project/:slug/local updates projects[key].mcpServers in ~/.claude.json', async () => {
  const projectDir = path.join(HOME, 'mcp-proj-b');
  fs.mkdirSync(projectDir, { recursive: true });
  const slug = pathToSlug(projectDir);

  const payload = { servers: { 'mcp-local-srv': { type: 'stdio', command: 'echo' } } };
  const put = await request(app).put(`/api/mcp/project/${slug}/local`).send(payload);
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.body.ok, true);
  assert.ok(put.body.projectKey);

  const raw = JSON.parse(fs.readFileSync(paths.CLAUDE_JSON, 'utf-8'));
  assert.ok(raw.projects[put.body.projectKey]);
  assert.ok(raw.projects[put.body.projectKey].mcpServers['mcp-local-srv']);
});

test('PUT /api/mcp/global with empty body coerces servers to {}', async () => {
  const put = await request(app).put('/api/mcp/global').send({});
  assert.strictEqual(put.status, 200);
  const raw = JSON.parse(fs.readFileSync(paths.CLAUDE_JSON, 'utf-8'));
  assert.deepStrictEqual(raw.mcpServers, {});
});
