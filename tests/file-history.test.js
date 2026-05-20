const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, paths, HOME } = require('./helpers/app');

const SESSION_ID = 'fhtest111-1111-1111-1111-111111111111';
const PROJ_SLUG = 'fh-test-project';
const HASH = 'deadbeef1234abcd';
const TRACKED_FILE = '/projects/myapp/src/index.js';

const FILE_HISTORY_DIR = path.join(paths.CLAUDE_DIR, 'file-history');
const PLANS_DIR = path.join(paths.CLAUDE_DIR, 'plans');
const SESSION_HIST_DIR = path.join(FILE_HISTORY_DIR, SESSION_ID);

// Session that tracks a file which physically exists on disk (for mtime tests)
const MTIME_SESSION_ID = 'mtimetest-2222-2222-2222-222222222222';
const MTIME_HASH = 'mtimehash00012ab';
const REAL_FILE = path.join(HOME, 'mtime-tracked-file.txt');

before(() => {
  // Project dir + session JSONL
  const projDir = path.join(paths.PROJECTS_DIR, PROJ_SLUG);
  fs.mkdirSync(projDir, { recursive: true });

  const entries = [
    { type: 'user', timestamp: '2026-01-01T10:00:00.000Z', message: { content: 'start' } },
    {
      type: 'file-history-snapshot',
      isSnapshotUpdate: true,
      snapshot: {
        trackedFileBackups: {
          [TRACKED_FILE]: { backupFileName: `${HASH}@v1`, version: 1 },
          '/projects/myapp/src/new-file.js': { backupFileName: null, version: 0 },
        }
      }
    },
    { type: 'user', timestamp: '2026-01-01T11:00:00.000Z', message: { content: 'end' } },
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'toolu_1', name: 'ExitPlanMode', input: { plan: '# In-range Plan\n\nContent.', planFilePath: `${paths.CLAUDE_DIR}/plans/fh-in-range-plan.md` } }
        ]
      }
    }
  ];
  fs.writeFileSync(
    path.join(projDir, SESSION_ID + '.jsonl'),
    entries.map(e => JSON.stringify(e)).join('\n')
  );

  // File history: v1 and v2 on disk
  fs.mkdirSync(SESSION_HIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(SESSION_HIST_DIR, `${HASH}@v1`), 'line one\nline two\n');
  fs.writeFileSync(path.join(SESSION_HIST_DIR, `${HASH}@v2`), 'line one\nline two modified\nadded line\n');

  // Plan within session window (10:00-11:00 ±30min → 09:30-11:30)
  fs.mkdirSync(PLANS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PLANS_DIR, 'fh-in-range-plan.md'), '# In-range Plan\n\nContent.');
  const inRangeTime = new Date('2026-01-01T10:30:00.000Z');
  fs.utimesSync(path.join(PLANS_DIR, 'fh-in-range-plan.md'), inRangeTime, inRangeTime);

  // Plan outside session window
  fs.writeFileSync(path.join(PLANS_DIR, 'fh-old-plan.md'), '# Old Plan');
  const oldTime = new Date('2025-01-01T00:00:00.000Z');
  fs.utimesSync(path.join(PLANS_DIR, 'fh-old-plan.md'), oldTime, oldTime);
});

// ── /context endpoint ─────────────────────────────────────────────────────────

test('context: returns 200 with files and plans arrays', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.files));
  assert.ok(Array.isArray(res.body.plans));
});

test('context: files with null backupFileName appear flagged as isNew', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  assert.strictEqual(res.status, 200);
  const newFile = res.body.files.find(f => f.path === '/projects/myapp/src/new-file.js');
  assert.ok(newFile, 'newly created file must appear in changes list');
  assert.strictEqual(newFile.isNew, true, 'must be flagged isNew');
  assert.strictEqual(newFile.hash, null, 'no hash for files with no backup');
  assert.deepStrictEqual(newFile.versions, [], 'no versions for files with no backup');
});

test('context: edited files have isNew=false', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  const file = res.body.files.find(f => f.path === TRACKED_FILE);
  assert.ok(file);
  assert.strictEqual(file.isNew, false);
});

test('context: files removed from disk are flagged isDeleted', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  const file = res.body.files.find(f => f.path === TRACKED_FILE);
  assert.ok(file);
  assert.strictEqual(file.isDeleted, true,
    'TRACKED_FILE path does not exist under the project dir, so it must be marked deleted');
});

test('context: versions array reflects files present on disk', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  const file = res.body.files.find(f => f.path === TRACKED_FILE);
  assert.ok(file, 'tracked file must be present');
  assert.deepStrictEqual(file.versions, [1, 2]);
});

test('context: projSlug is returned', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  assert.strictEqual(res.body.projSlug, PROJ_SLUG);
});

test('context: plans linked via ExitPlanMode planFilePath appear', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  assert.strictEqual(res.status, 200);
  const names = res.body.plans.map(p => p.name);
  assert.ok(names.includes('fh-in-range-plan'), 'plan referenced in ExitPlanMode must appear');
  assert.ok(!names.includes('fh-old-plan'), 'plan not referenced must not appear');
});

test('context: plans not linked via ExitPlanMode are excluded even if mtime overlaps', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  assert.strictEqual(res.status, 200);
  const names = res.body.plans.map(p => p.name);
  assert.ok(!names.includes('fh-old-plan'), 'unreferenced plan must not appear regardless of mtime');
});

test('context: invalid sessionId returns 400', async () => {
  const res = await request(app).get('/api/file-history/..bad..id/context');
  assert.strictEqual(res.status, 400);
});

test('context: unknown session returns empty files and plans', async () => {
  const res = await request(app).get('/api/file-history/99999999-0000-0000-0000-000000000000/context');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.files, []);
  assert.deepStrictEqual(res.body.plans, []);
});

// ── /diff endpoint ────────────────────────────────────────────────────────────

test('diff: returns hunks and stats for changed versions', async () => {
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/${HASH}/diff`)
    .query({ from: 1, to: 2 });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.hunks));
  assert.ok(typeof res.body.stats === 'object');
  assert.ok(typeof res.body.stats.added === 'number');
  assert.ok(typeof res.body.stats.removed === 'number');
  assert.ok(res.body.stats.added > 0 || res.body.stats.removed > 0, 'diff must detect changes');
});

test('diff: identical versions produce empty hunks', async () => {
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/${HASH}/diff`)
    .query({ from: 1, to: 1 });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.hunks, []);
  assert.strictEqual(res.body.stats.added, 0);
  assert.strictEqual(res.body.stats.removed, 0);
});

test('diff: missing version file returns 404', async () => {
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/${HASH}/diff`)
    .query({ from: 99, to: 100 });
  assert.strictEqual(res.status, 404);
});

test('diff: path traversal in sessionId returns 400', async () => {
  const res = await request(app)
    .get(`/api/file-history/..bad..id/${HASH}/diff`)
    .query({ from: 1, to: 2 });
  assert.strictEqual(res.status, 400);
});

test('diff: path traversal in hash returns 400', async () => {
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/..badhash/diff`)
    .query({ from: 1, to: 2 });
  assert.strictEqual(res.status, 400);
});

// ── /diff-current with isNew ─────────────────────────────────────────────────

test('diff-current: isNew=true skips snapshot read and returns 200 even with bogus hash', async () => {
  // When isNew is true, we don't read a snapshot — so a non-existent hash is fine
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/none/diff-current`)
    .query({ isNew: 'true', projSlug: PROJ_SLUG, filePath: 'nonexistent.js' });
  assert.strictEqual(res.status, 200);
  // current file doesn't exist either, so both sides empty → no hunks
  assert.deepStrictEqual(res.body.hunks, []);
  assert.strictEqual(res.body.stats.added, 0);
  assert.strictEqual(res.body.stats.removed, 0);
});

test('diff-current: without isNew, missing version still returns 404', async () => {
  const res = await request(app)
    .get(`/api/file-history/${SESSION_ID}/${HASH}/diff-current`)
    .query({ version: 99, projSlug: PROJ_SLUG, filePath: 'created.js' });
  assert.strictEqual(res.status, 404);
});

// ── mtime field ───────────────────────────────────────────────────────────────

before(() => {
  fs.writeFileSync(REAL_FILE, 'real tracked content');

  const projDir = path.join(paths.PROJECTS_DIR, PROJ_SLUG);
  const entries = [
    { type: 'user', timestamp: '2026-02-01T10:00:00.000Z', message: { content: 'mtime test' } },
    {
      type: 'file-history-snapshot',
      isSnapshotUpdate: true,
      snapshot: {
        trackedFileBackups: {
          [REAL_FILE]: { backupFileName: `${MTIME_HASH}@v1`, version: 1 }
        }
      }
    }
  ];
  fs.writeFileSync(
    path.join(projDir, MTIME_SESSION_ID + '.jsonl'),
    entries.map(e => JSON.stringify(e)).join('\n')
  );

  const histDir = path.join(FILE_HISTORY_DIR, MTIME_SESSION_ID);
  fs.mkdirSync(histDir, { recursive: true });
  fs.writeFileSync(path.join(histDir, `${MTIME_HASH}@v1`), 'backup of real file');
});

test('context: mtime is a number for files that exist on disk', async () => {
  const res = await request(app).get(`/api/file-history/${MTIME_SESSION_ID}/context`);
  assert.strictEqual(res.status, 200);
  const file = res.body.files.find(f => f.path === REAL_FILE);
  assert.ok(file, 'tracked real file must appear');
  assert.strictEqual(typeof file.mtime, 'number');
  assert.ok(file.mtime > 0);
  assert.strictEqual(file.isDeleted, false);
});

test('context: mtime is null and isDeleted=true for files missing from disk', async () => {
  const res = await request(app).get(`/api/file-history/${SESSION_ID}/context`);
  const file = res.body.files.find(f => f.path === TRACKED_FILE);
  assert.ok(file);
  assert.strictEqual(file.mtime, null);
  assert.strictEqual(file.isDeleted, true);
});
