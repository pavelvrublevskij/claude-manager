const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load sessions.js in a minimal browser-like sandbox so we can call pure methods
const src = fs.readFileSync(path.join(__dirname, '../public/js/sessions.js'), 'utf-8');
const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  renderSessionCard: () => '',
  escapeHtml: s => String(s),
  debounce: fn => fn,
  api: async () => {},
  toast: () => {},
  ProjectUsage: {},
  copyToClipboard: () => {},
  decodeName: s => s,
  renderSessionBadges: () => '',
  setFooterStatus: () => {},
  showLoading: () => {},
  App: { navigate: () => {}, setHash: () => {} },
  TerminalPanel: { isOpen: () => false, shouldAutoOpen: () => false },
});
vm.runInContext(src + '\nglobalThis._Sessions = Sessions;', context);
const { groupSessions, filterByDateRange, _searchKey, _detailSearchKey } = context._Sessions;

function makeSession(id, opts = {}) {
  return {
    sessionId: id,
    firstPrompt: opts.firstPrompt || '',
    summary: opts.summary || '',
    gitBranch: opts.gitBranch || 'main',
    lastGitBranch: opts.lastGitBranch || opts.gitBranch || 'main',
    created: opts.created || '2026-01-01T10:00:00.000Z',
    modified: opts.modified || opts.created || '2026-01-01T10:00:00.000Z',
  };
}

test('groupSessions: two sessions with same ticket form a group', () => {
  const s1 = makeSession('s1', { firstPrompt: '/specify PROJ-100', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T10:30:00.000Z' });
  const s2 = makeSession('s2', { firstPrompt: '/plan PROJ-100', created: '2026-01-02T09:00:00.000Z', modified: '2026-01-02T10:00:00.000Z' });
  const { groups, ungrouped } = groupSessions([s1, s2]);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].type, 'ticket');
  assert.strictEqual(groups[0].label, 'PROJ-100');
  assert.strictEqual(groups[0].sessions.length, 2);
  assert.strictEqual(ungrouped.length, 0);
});

test('groupSessions: two sessions on same non-main branch form a group', () => {
  const s1 = makeSession('s1', { gitBranch: 'feature/auth', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T11:00:00.000Z' });
  const s2 = makeSession('s2', { gitBranch: 'feature/auth', created: '2026-01-03T09:00:00.000Z', modified: '2026-01-03T10:00:00.000Z' });
  const { groups, ungrouped } = groupSessions([s1, s2]);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].type, 'branch');
  assert.strictEqual(groups[0].label, 'feature/auth');
  assert.strictEqual(ungrouped.length, 0);
});

test('groupSessions: two sessions within 30min on same branch form a temporal group', () => {
  const s1 = makeSession('s1', { gitBranch: 'main', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T10:20:00.000Z' });
  const s2 = makeSession('s2', { gitBranch: 'main', created: '2026-01-01T10:25:00.000Z', modified: '2026-01-01T10:45:00.000Z' });
  const { groups, ungrouped } = groupSessions([s1, s2]);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].type, 'temporal');
  assert.strictEqual(ungrouped.length, 0);
});

test('groupSessions: sessions more than 30min apart on main do not form a temporal group', () => {
  const s1 = makeSession('s1', { gitBranch: 'main', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T10:20:00.000Z' });
  const s2 = makeSession('s2', { gitBranch: 'main', created: '2026-01-01T11:00:00.000Z', modified: '2026-01-01T11:30:00.000Z' });
  const { groups, ungrouped } = groupSessions([s1, s2]);
  assert.strictEqual(groups.length, 0);
  assert.strictEqual(ungrouped.length, 2);
});

test('groupSessions: single-session groups fall to ungrouped', () => {
  const s1 = makeSession('s1', { firstPrompt: '/specify PROJ-1', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T11:00:00.000Z' });
  const s2 = makeSession('s2', { firstPrompt: '/specify PROJ-2', created: '2026-01-02T10:00:00.000Z', modified: '2026-01-02T11:00:00.000Z' });
  const { groups, ungrouped } = groupSessions([s1, s2]);
  assert.strictEqual(groups.length, 0);
  assert.strictEqual(ungrouped.length, 2);
});

test('groupSessions: ungrouped sessions sorted desc by modified', () => {
  const s1 = makeSession('s1', { created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T10:00:00.000Z' });
  const s2 = makeSession('s2', { created: '2026-01-03T10:00:00.000Z', modified: '2026-01-03T10:00:00.000Z' });
  const s3 = makeSession('s3', { created: '2026-01-02T10:00:00.000Z', modified: '2026-01-02T10:00:00.000Z' });
  const { ungrouped } = groupSessions([s1, s2, s3]);
  assert.strictEqual(ungrouped.length, 3);
  assert.strictEqual(ungrouped[0].sessionId, 's2');
  assert.strictEqual(ungrouped[1].sessionId, 's3');
  assert.strictEqual(ungrouped[2].sessionId, 's1');
});

test('groupSessions: groups sorted desc by most recent session', () => {
  const g1s1 = makeSession('g1s1', { firstPrompt: 'PROJ-10', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T11:00:00.000Z' });
  const g1s2 = makeSession('g1s2', { firstPrompt: 'PROJ-10', created: '2026-01-02T10:00:00.000Z', modified: '2026-01-02T11:00:00.000Z' });
  const g2s1 = makeSession('g2s1', { firstPrompt: 'PROJ-20', created: '2026-01-05T10:00:00.000Z', modified: '2026-01-05T11:00:00.000Z' });
  const g2s2 = makeSession('g2s2', { firstPrompt: 'PROJ-20', created: '2026-01-06T10:00:00.000Z', modified: '2026-01-06T11:00:00.000Z' });
  const { groups } = groupSessions([g1s1, g1s2, g2s1, g2s2]);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].label, 'PROJ-20');
  assert.strictEqual(groups[1].label, 'PROJ-10');
});

test('groupSessions: sessions within group are in chronological order (asc)', () => {
  const s1 = makeSession('s1', { firstPrompt: 'PROJ-99', created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T11:00:00.000Z' });
  const s2 = makeSession('s2', { firstPrompt: 'PROJ-99', created: '2026-01-03T10:00:00.000Z', modified: '2026-01-03T11:00:00.000Z' });
  const { groups } = groupSessions([s2, s1]);
  assert.strictEqual(groups[0].sessions[0].sessionId, 's1');
  assert.strictEqual(groups[0].sessions[1].sessionId, 's2');
});

test('groupSessions: main/master/HEAD/develop/dev branches are not used for branch grouping', () => {
  for (const branch of ['main', 'master', 'HEAD', 'develop', 'dev']) {
    const s1 = makeSession('s1', { gitBranch: branch, created: '2026-01-01T10:00:00.000Z', modified: '2026-01-01T10:00:00.000Z' });
    const s2 = makeSession('s2', { gitBranch: branch, created: '2026-01-05T10:00:00.000Z', modified: '2026-01-05T10:00:00.000Z' });
    const { groups } = groupSessions([s1, s2]);
    assert.strictEqual(groups.length, 0, `branch "${branch}" should not trigger branch grouping`);
  }
});

// ── Search history key scoping ────────────────────────────────────────────────

test('_searchKey returns a key containing the slug', () => {
  assert.ok(_searchKey('my-project').includes('my-project'));
});

test('_detailSearchKey returns a key containing the slug', () => {
  assert.ok(_detailSearchKey('my-project').includes('my-project'));
});

test('_searchKey differs between slugs', () => {
  assert.notStrictEqual(_searchKey('proj-a'), _searchKey('proj-b'));
});

test('_detailSearchKey differs between slugs', () => {
  assert.notStrictEqual(_detailSearchKey('proj-a'), _detailSearchKey('proj-b'));
});

test('_searchKey and _detailSearchKey are distinct for the same slug', () => {
  assert.notStrictEqual(_searchKey('proj-a'), _detailSearchKey('proj-a'));
});
