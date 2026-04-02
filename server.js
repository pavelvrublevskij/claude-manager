const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1';

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

app.get('/api/version', async (req, res) => {
  const latest = await checkLatestVersion();
  const updateAvailable = latest && latest !== version;
  res.json({ version, latest, updateAvailable });
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Claude Manager running at http://${HOST}:${PORT}`);
});
