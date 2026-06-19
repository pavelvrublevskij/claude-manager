const { test } = require('node:test');
const assert = require('node:assert');
const https = require('https');

const OWNER = 'pavelvrublevskij';
const REPO = 'claude-manager';
const KNOWN_TAG = 'v1.2.0';

// Mirrors downloadZip() in server.js — follows redirects using https module.
// api.github.com/zipball returns HTTP 300 (no Location) for tags, so we use
// the github.com/archive URL which properly returns 302 -> codeload -> 200.
function downloadZip(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'claude-manager' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (!redirectsLeft) return reject(new Error('Too many redirects'));
        return resolve(downloadZip(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function assertValidZip(buf, label) {
  assert.ok(buf.length > 1000, `${label}: zip too small (${buf.length} bytes)`);
  assert.strictEqual(buf[0], 0x50, `${label}: expected ZIP magic byte P`);
  assert.strictEqual(buf[1], 0x4B, `${label}: expected ZIP magic byte K`);
}

test('archive tag zip URL follows redirect and returns valid zip', async () => {
  const url = `https://github.com/${OWNER}/${REPO}/archive/refs/tags/${KNOWN_TAG}.zip`;
  const buf = await downloadZip(url);
  assertValidZip(buf, KNOWN_TAG);
}, { timeout: 15000 });

test('archive main-branch zip URL follows redirect and returns valid zip', async () => {
  const url = `https://github.com/${OWNER}/${REPO}/archive/refs/heads/main.zip`;
  const buf = await downloadZip(url);
  assertValidZip(buf, 'main');
}, { timeout: 15000 });

test('api.github.com zipball URL returns HTTP 300 for tags (known GitHub behavior)', async () => {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/zipball/${KNOWN_TAG}`;
  await assert.rejects(
    () => downloadZip(url),
    err => { assert.ok(err.message.includes('300'), `expected HTTP 300 but got: ${err.message}`); return true; }
  );
}, { timeout: 15000 });
