const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { PROJECTS_DIR, SKILLS_DIR, OUTPUT_STYLES_DIR, MCP_FILE, KEYBINDINGS_FILE } = require('../lib/paths');
const { readJson, wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { buildIndex, calcCostMultiModel } = require('../lib/usage-index');

/** Gather dashboard stats and recent sessions across all projects. */
router.get('/', wrapRoute(async (req, res) => {
  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());

  let totalSessions = 0;
  let totalMemory = 0;
  const recentSessions = [];

  for (const d of dirs) {
    const slug = d.name;
    const projectDir = path.join(PROJECTS_DIR, slug);
    const decodedPath = decodeSlug(slug);

    // Count memory files
    const memoryDir = path.join(projectDir, 'memory');
    if (fs.existsSync(memoryDir)) {
      try { totalMemory += fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).length; } catch (_) {}
    }

    // Collect sessions from index or fallback
    const indexFile = path.join(projectDir, 'sessions-index.json');
    if (fs.existsSync(indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        const entries = (data.entries || []).filter(e => e.messageCount > 0);
        totalSessions += entries.length;
        for (const e of entries) {
          recentSessions.push({
            slug,
            projectName: decodedPath,
            sessionId: e.sessionId,
            summary: e.summary || '',
            firstPrompt: e.firstPrompt || '',
            messageCount: e.messageCount || 0,
            created: e.created || null,
            modified: e.modified || null,
            gitBranch: e.gitBranch || ''
          });
        }
      } catch (_) { /* malformed index */ }
    } else {
      // Fallback: count .jsonl files
      try {
        const jsonls = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
        totalSessions += jsonls.length;
        // Parse first line for recent sessions (lightweight)
        for (const f of jsonls) {
          const filePath = path.join(projectDir, f);
          const stat = fs.statSync(filePath);
          try {
            const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
            let firstPrompt = '', created = null, gitBranch = '', msgCount = 0;
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (entry.type === 'user') {
                  msgCount++;
                  if (msgCount === 1) {
                    firstPrompt = typeof entry.message?.content === 'string' ? entry.message.content.slice(0, 200) : '';
                    created = entry.timestamp || stat.birthtime.toISOString();
                    gitBranch = entry.gitBranch || '';
                  }
                }
              } catch (_) { /* malformed line */ }
            }
            if (msgCount > 0) {
              recentSessions.push({
                slug,
                projectName: decodedPath,
                sessionId: f.replace('.jsonl', ''),
                summary: '',
                firstPrompt,
                messageCount: msgCount,
                created,
                modified: stat.mtime.toISOString(),
                gitBranch
              });
            }
          } catch (_) { /* unreadable file */ }
        }
      } catch (_) {}
    }
  }

  // Enrich with token usage
  const usageIndex = buildIndex();
  for (const s of recentSessions) {
    const entry = usageIndex.sessions[s.slug + '/' + s.sessionId];
    if (entry) {
      s.tokens = entry.totals;
      s.cost = calcCostMultiModel(entry.byModel || {}).total;
      s.models = Object.keys(entry.byModel || {});
    }
  }

  // Sort by modified desc, take top 10
  recentSessions.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));

  // Count other resources
  const mcpData = readJson(MCP_FILE, { servers: {} });
  const mcpCount = Object.keys(mcpData.servers || {}).length;
  let skillsCount = 0;
  if (fs.existsSync(SKILLS_DIR)) {
    try { skillsCount = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).length; } catch (_) {}
  }
  let stylesCount = 0;
  if (fs.existsSync(OUTPUT_STYLES_DIR)) {
    try { stylesCount = fs.readdirSync(OUTPUT_STYLES_DIR).filter(f => f.endsWith('.md')).length; } catch (_) {}
  }
  const kbData = readJson(KEYBINDINGS_FILE, { bindings: [] });
  const kbCount = (kbData.bindings || []).reduce((sum, ctx) => sum + Object.keys(ctx.bindings || {}).length, 0);

  res.json({
    stats: {
      projects: dirs.length,
      sessions: totalSessions,
      memoryFiles: totalMemory,
      mcpServers: mcpCount,
      skills: skillsCount,
      outputStyles: stylesCount,
      keybindings: kbCount
    },
    recentSessions: recentSessions.slice(0, 10)
  });
}));

module.exports = router;
