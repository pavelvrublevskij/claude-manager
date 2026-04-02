const express = require('express');
const fs = require('fs');
const path = require('path');
const { wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { PROJECTS_DIR } = require('../lib/paths');

const router = express.Router();

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

    return {
      slug,
      path: decodedPath,
      memoryCount,
      hasMemory,
      sessionCount,
      hasClaudeMd,
      hasAiMemory
    };
  });

  res.json(projects);
}));

module.exports = router;
