const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { wrapRoute, safeSlug } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { PROJECTS_DIR } = require('../lib/paths');

const router = express.Router();

function openFolder(folderPath) {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'darwin') {
    execFile('open', [folderPath]);
  } else {
    execFile('xdg-open', [folderPath]);
  }
}

router.get('/', wrapRoute((req, res) => {
  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  const projects = dirs.map(d => {
    const slug = d.name;
    const projectDir = path.join(PROJECTS_DIR, slug);
    const memoryDir = path.join(projectDir, 'memory');
    let memoryCount = 0;
    let hasMemory = false;

    if (fs.existsSync(memoryDir)) {
      hasMemory = true;
      try {
        memoryCount = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).length;
      } catch (_) { /* empty dir or permission error */ }
    }

    let sessionCount = 0;
    try {
      sessionCount = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl')).length;
    } catch (_) { /* empty dir or permission error */ }

    const decodedPath = decodeSlug(slug);
    const projectClaudeMd = path.join(decodedPath, 'CLAUDE.md');
    const hasClaudeMd = fs.existsSync(projectClaudeMd);

    const aiMemoryDir = path.join(decodedPath, '.ai_project_memory');
    const hasAiMemory = fs.existsSync(aiMemoryDir);

    const projSkillsDir = path.join(decodedPath, '.claude', 'skills');
    let skillsCount = 0;
    if (fs.existsSync(projSkillsDir)) {
      try { skillsCount = fs.readdirSync(projSkillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).length; } catch (_) {}
    }

    const projStylesDir = path.join(decodedPath, '.claude', 'output-styles');
    let outputStylesCount = 0;
    if (fs.existsSync(projStylesDir)) {
      try { outputStylesCount = fs.readdirSync(projStylesDir).filter(f => f.endsWith('.md')).length; } catch (_) {}
    }

    return {
      slug,
      path: decodedPath,
      memoryCount,
      hasMemory,
      sessionCount,
      skillsCount,
      outputStylesCount,
      hasClaudeMd,
      hasAiMemory
    };
  });

  res.json(projects);
}));

router.post('/:slug/open-folder', wrapRoute((req, res) => {
  if (process.env.DOCKER) return res.status(400).json({ error: 'Disabled in Docker' });
  if (!safeSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid slug' });
  const projectPath = decodeSlug(req.params.slug);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return res.status(404).json({ error: 'Folder does not exist on disk' });
  }
  openFolder(projectPath);
  res.json({ ok: true });
}));

module.exports = router;
