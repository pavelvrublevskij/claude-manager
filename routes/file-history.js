const express = require('express');
const fs = require('fs');
const path = require('path');
const { CLAUDE_DIR, PROJECTS_DIR } = require('../lib/paths');
const { wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');

const PLANS_DIR = path.join(CLAUDE_DIR, 'plans');

const router = express.Router();
const FILE_HISTORY_DIR = path.join(CLAUDE_DIR, 'file-history');

router.get('/:sessionId/context', wrapRoute((req, res) => {
  const { sessionId } = req.params;
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const histDir = path.join(FILE_HISTORY_DIR, sessionId);
  let files = [];
  let sessionFrom = null, sessionTo = null;

  let projSlug = null;
  if (fs.existsSync(histDir)) {
    // Find the session JSONL to get file path mappings
    let sessionContent = null;
    for (const proj of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const candidate = path.join(PROJECTS_DIR, proj.name, sessionId + '.jsonl');
      if (fs.existsSync(candidate)) {
        try { sessionContent = fs.readFileSync(candidate, 'utf-8'); projSlug = proj.name; } catch (_) {}
        break;
      }
    }

    if (sessionContent) {
      const fileMap = {};
      for (const line of sessionContent.split('\n')) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'user' && obj.timestamp) {
            const t = new Date(obj.timestamp).getTime();
            if (!sessionFrom) sessionFrom = t;
            sessionTo = t;
          }
          if (obj.type !== 'file-history-snapshot' || !obj.isSnapshotUpdate) continue;
          const backups = obj.snapshot && obj.snapshot.trackedFileBackups;
          if (!backups) continue;
          for (const [filePath, info] of Object.entries(backups)) {
            if (!info.backupFileName) continue;
            if (!fileMap[filePath]) fileMap[filePath] = { hash: info.backupFileName.split('@')[0], maxVersion: 0 };
            fileMap[filePath].maxVersion = Math.max(fileMap[filePath].maxVersion, info.version);
          }
        } catch (_) {}
      }

      const histFiles = fs.readdirSync(histDir);
      files = Object.entries(fileMap).map(([filePath, info]) => {
        const versions = histFiles
          .filter(f => f.startsWith(info.hash + '@v'))
          .map(f => parseInt(f.split('@v')[1], 10))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);
        return { path: filePath, hash: info.hash, versions };
      }).filter(f => f.versions.length > 0);
    }
  }

  // Plans active during this session time range
  let plans = [];
  const from = req.query.from ? new Date(req.query.from).getTime() : sessionFrom;
  const to = req.query.to ? new Date(req.query.to).getTime() : sessionTo;
  if (from && to && fs.existsSync(PLANS_DIR)) {
    const slack = 30 * 60 * 1000; // 30-min window either side
    plans = fs.readdirSync(PLANS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(PLANS_DIR, f));
        const t = new Date(stat.mtime).getTime();
        return { name: f.replace(/\.md$/, ''), mtime: stat.mtime, t };
      })
      .filter(p => p.t >= from - slack && p.t <= to + slack)
      .map(({ name, mtime }) => ({ name, mtime }));
  }

  res.json({ files, plans, projSlug });
}));


router.get('/:sessionId/:hash/diff', wrapRoute((req, res) => {
  const { sessionId, hash } = req.params;
  const from = parseInt(req.query.from, 10);
  const to = parseInt(req.query.to, 10);

  for (const p of [sessionId, hash]) {
    if (p.includes('..') || p.includes('/') || p.includes('\\')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
  }

  const histDir = path.join(FILE_HISTORY_DIR, sessionId);
  const fromFile = path.join(histDir, `${hash}@v${from}`);
  const toFile = path.join(histDir, `${hash}@v${to}`);

  if (!fs.existsSync(fromFile) || !fs.existsSync(toFile)) {
    return res.status(404).json({ error: 'Version not found' });
  }

  const oldText = fs.readFileSync(fromFile, 'utf-8');
  const newText = fs.readFileSync(toFile, 'utf-8');
  res.json(computeDiff(oldText, newText));
}));

router.get('/:sessionId/:hash/diff-current', wrapRoute((req, res) => {
  const { sessionId, hash } = req.params;
  const version = parseInt(req.query.version, 10);
  const { projSlug, filePath } = req.query;

  for (const p of [sessionId, hash]) {
    if (p.includes('..') || p.includes('/') || p.includes('\\')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
  }
  if (!projSlug || projSlug.includes('..') || projSlug.includes('/') || projSlug.includes('\\')) {
    return res.status(400).json({ error: 'Invalid projSlug' });
  }

  const histDir = path.join(FILE_HISTORY_DIR, sessionId);
  const fromFile = path.join(histDir, `${hash}@v${version}`);
  if (!fs.existsSync(fromFile)) return res.status(404).json({ error: 'Version not found' });

  const projectDir = decodeSlug(projSlug);
  if (!projectDir) return res.status(404).json({ error: 'Project not found' });

  const currentFile = path.resolve(projectDir, filePath);
  const rel = path.relative(path.resolve(projectDir), currentFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }
  if (!fs.existsSync(currentFile)) return res.status(404).json({ error: 'Current file not found' });

  const oldText = fs.readFileSync(fromFile, 'utf-8');
  const newText = fs.readFileSync(currentFile, 'utf-8');
  res.json(computeDiff(oldText, newText));
}));

function computeDiff(oldText, newText) {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const m = a.length, n = b.length;

  if (m > 3000 || n > 3000) {
    return { hunks: [], stats: { added: 0, removed: 0 }, tooLarge: true };
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      ops.push({ t: '=', c: a[i-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ t: '+', c: b[j-1] });
      j--;
    } else {
      ops.push({ t: '-', c: a[i-1] });
      i--;
    }
  }
  ops.reverse();

  const CTX = 3;
  const inHunk = new Set();
  let added = 0, removed = 0;
  ops.forEach((op, idx) => {
    if (op.t !== '=') {
      for (let k = Math.max(0, idx - CTX); k <= Math.min(ops.length - 1, idx + CTX); k++) {
        inHunk.add(k);
      }
      if (op.t === '+') added++;
      else removed++;
    }
  });

  if (!inHunk.size) return { hunks: [], stats: { added: 0, removed: 0 } };

  const ranges = [];
  let rs = -1;
  for (let k = 0; k < ops.length; k++) {
    if (inHunk.has(k)) {
      if (rs === -1) rs = k;
    } else if (rs !== -1) {
      ranges.push([rs, k - 1]);
      rs = -1;
    }
  }
  if (rs !== -1) ranges.push([rs, ops.length - 1]);

  const hunks = ranges.map(([start, end]) => {
    let oldLine = 1, newLine = 1;
    for (let k = 0; k < start; k++) {
      if (ops[k].t !== '+') oldLine++;
      if (ops[k].t !== '-') newLine++;
    }
    const lines = [];
    for (let k = start; k <= end; k++) {
      lines.push({ type: ops[k].t, content: ops[k].c });
    }
    return { oldStart: oldLine, newStart: newLine, lines };
  });

  return { hunks, stats: { added, removed } };
}

module.exports = router;
