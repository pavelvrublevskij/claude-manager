const { test } = require('node:test');
const assert = require('node:assert');

const OWNER = 'pavelvrublevskij';
const REPO = 'claude-manager';
const KNOWN_TAG = 'v1.2.0';

test('codeload tag zip returns 200 with valid zip content', async () => {
  const url = `https://codeload.github.com/${OWNER}/${REPO}/zip/refs/tags/${KNOWN_TAG}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'claude-manager' } });
  assert.strictEqual(r.status, 200, `expected 200 but got ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  assert.ok(
    ct.includes('zip') || ct.includes('octet-stream'),
    `unexpected content-type: ${ct}`
  );
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 1000, `zip too small (${buf.length} bytes) — likely not a real archive`);
  assert.strictEqual(buf[0], 0x50, 'expected ZIP magic byte P');
  assert.strictEqual(buf[1], 0x4B, 'expected ZIP magic byte K');
}, { timeout: 15000 });

test('codeload main-branch zip returns 200 with valid zip content', async () => {
  const url = `https://codeload.github.com/${OWNER}/${REPO}/zip/refs/heads/main`;
  const r = await fetch(url, { headers: { 'User-Agent': 'claude-manager' } });
  assert.strictEqual(r.status, 200, `expected 200 but got ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 1000, `zip too small (${buf.length} bytes) — likely not a real archive`);
  assert.strictEqual(buf[0], 0x50, 'expected ZIP magic byte P');
  assert.strictEqual(buf[1], 0x4B, 'expected ZIP magic byte K');
}, { timeout: 15000 });
