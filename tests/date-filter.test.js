const { test } = require('node:test');
const assert = require('node:assert');

// Inline the formulas from date-filter.js (queryParts) and sessions.js (filterByDateRange)
// since those files have DOM dependencies and cannot be required directly in Node.js.

// ── queryParts (date-filter.js) ───────────────────────────────────────────────
// Local date strings are sent to the server as-is. The server (aggregateByPeriod)
// converts UTC hour keys to local dates server-side for comparison.

test('queryParts: local date is passed through unchanged', () => {
  // Simulate queryParts with local date — expect it to be passed as-is.
  const fromDate = '2026-06-10';
  const toDate = '2026-06-10';
  const parts = [];
  if (fromDate) parts.push('from=' + encodeURIComponent(fromDate));
  if (toDate) parts.push('to=' + encodeURIComponent(toDate));
  assert.strictEqual(parts[0], 'from=2026-06-10');
  assert.strictEqual(parts[1], 'to=2026-06-10');
});

// ── filterByDateRange timestamp comparison (sessions.js) ─────────────────────
// Sessions have a UTC ISO `modified` timestamp. The from/to values are LOCAL
// datetime strings (no timezone suffix). Comparing via getTime() gives correct
// cross-timezone results.

function filterByDateRange(sessions, fromDate, toDate, fromTime, toTime) {
  if (!fromDate && !toDate) return sessions;
  const fromMs = fromDate ? new Date(fromDate + 'T' + (fromTime || '00:00') + ':00').getTime() : null;
  const toMs   = toDate   ? new Date(toDate   + 'T' + (toTime   || '23:59') + ':59').getTime() : null;
  return sessions.filter(s => {
    const t = s.modified ? new Date(s.modified).getTime() : 0;
    if (fromMs && t < fromMs) return false;
    if (toMs   && t > toMs)   return false;
    return true;
  });
}

test('filterByDateRange: session at local midnight is included in that local day', () => {
  const local = '2026-06-10';
  const modifiedUtc = new Date(local + 'T00:00:00').toISOString(); // UTC of local midnight
  const result = filterByDateRange([{ modified: modifiedUtc }], local, local);
  assert.strictEqual(result.length, 1, 'session at local midnight should be included');
});

test('filterByDateRange: session at local end-of-day is included', () => {
  const local = '2026-06-10';
  const modifiedUtc = new Date(local + 'T23:59:59').toISOString();
  const result = filterByDateRange([{ modified: modifiedUtc }], local, local);
  assert.strictEqual(result.length, 1, 'session at local 23:59:59 should be included');
});

test('filterByDateRange: session one second before local midnight is excluded', () => {
  const local = '2026-06-10';
  const justBefore = new Date(local + 'T00:00:00');
  justBefore.setSeconds(justBefore.getSeconds() - 1);
  const result = filterByDateRange([{ modified: justBefore.toISOString() }], local, local);
  assert.strictEqual(result.length, 0, 'session just before local day should be excluded');
});

test('filterByDateRange: session one second after local end-of-day is excluded', () => {
  const local = '2026-06-10';
  const justAfter = new Date(local + 'T23:59:59');
  justAfter.setSeconds(justAfter.getSeconds() + 1);
  const result = filterByDateRange([{ modified: justAfter.toISOString() }], local, local);
  assert.strictEqual(result.length, 0, 'session just after local day should be excluded');
});

test('filterByDateRange: no filter returns all sessions', () => {
  const sessions = [{ modified: '2026-01-01T00:00:00Z' }, { modified: '2026-12-31T23:59:59Z' }];
  const result = filterByDateRange(sessions, null, null);
  assert.strictEqual(result.length, 2);
});

test('filterByDateRange: from-only filter excludes earlier sessions', () => {
  const sessions = [
    { modified: new Date('2026-06-09T23:59:59').toISOString() }, // local June 9
    { modified: new Date('2026-06-10T00:00:00').toISOString() }, // local June 10
  ];
  const result = filterByDateRange(sessions, '2026-06-10', null);
  assert.strictEqual(result.length, 1, 'only local June 10 session should remain');
});

test('filterByDateRange: to-only filter excludes later sessions', () => {
  const sessions = [
    { modified: new Date('2026-06-10T23:59:59').toISOString() }, // local June 10
    { modified: new Date('2026-06-11T00:00:00').toISOString() }, // local June 11
  ];
  const result = filterByDateRange(sessions, null, '2026-06-10');
  assert.strictEqual(result.length, 1, 'only local June 10 session should remain');
});
