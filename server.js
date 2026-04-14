const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Version endpoint with remote update check
const { version } = require('./package.json');
const https = require('https');

let latestVersionCache = { version: null, checkedAt: 0 };
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const REMOTE_PACKAGE_URL = 'https://raw.githubusercontent.com/pavelvrublevskij/claude-manager/main/package.json';

function checkLatestVersion() {
  return new Promise(resolve => {
    const now = Date.now();
    if (latestVersionCache.version && now - latestVersionCache.checkedAt < UPDATE_CHECK_INTERVAL) {
      return resolve(latestVersionCache.version);
    }
    https.get(REMOTE_PACKAGE_URL, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const remote = JSON.parse(data);
          latestVersionCache = { version: remote.version, checkedAt: now };
          resolve(remote.version);
        } catch (_) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function isNewer(remote, local) {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

app.get('/api/version', async (req, res) => {
  const latest = await checkLatestVersion();
  const updateAvailable = latest && latest !== version && isNewer(latest, version);
  res.json({ version, latest, updateAvailable });
});

const fs = require('fs');
app.get('/api/changelog', (req, res) => {
  const file = path.join(__dirname, 'CHANGELOG.md');
  if (!fs.existsSync(file)) return res.json({ content: 'No changelog found.' });
  res.json({ content: fs.readFileSync(file, 'utf-8') });
});

// Mount API routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects', require('./routes/sessions'));
app.use('/api/projects', require('./routes/memory'));
app.use('/api/claude-md', require('./routes/claude-md'));
app.use('/api/mcp', require('./routes/mcp'));
app.use('/api/keybindings', require('./routes/keybindings'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/output-styles', require('./routes/output-styles'));
app.use('/api/plugins', require('./routes/plugins'));
app.use('/api/project-settings', require('./routes/project-settings'));
app.use('/api/usage', require('./routes/usage'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Claude Manager running at http://${HOST}:${PORT}`);
});
