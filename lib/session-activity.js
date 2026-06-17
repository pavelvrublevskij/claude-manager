const fs = require('fs');
const path = require('path');

const AGENT_TOOLS = new Set(['Agent', 'Task', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskOutput']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit']);

const MAX_SUBAGENT_FILE_BYTES = 2 * 1024 * 1024;

function getCategory(name) {
  if (AGENT_TOOLS.has(name)) return 'agent';
  if (WEB_TOOLS.has(name)) return 'web';
  if (SHELL_TOOLS.has(name)) return 'shell';
  if (FILE_TOOLS.has(name)) return 'file';
  return 'other';
}

function getLabel(name, input) {
  switch (name) {
    case 'Bash':
    case 'PowerShell': return (input.command || '');
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit': return input.file_path || '';
    case 'NotebookEdit': return input.notebook_path || '';
    case 'Glob': return input.pattern || '';
    case 'Grep': return input.pattern || '';
    case 'WebFetch': return input.url || '';
    case 'WebSearch': return input.query || '';
    case 'Agent': return input.description || (input.prompt || '').slice(0, 200);
    default: return JSON.stringify(input).slice(0, 200);
  }
}

function extractAgentLabel(lines) {
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const c = entry.message?.content;
      if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 200);
      if (Array.isArray(c)) {
        for (const b of c) {
          if (b.type === 'text' && b.text?.trim()) return b.text.trim().slice(0, 200);
        }
      }
    } catch (_) {}
  }
  return null;
}

function collectFromJsonl(jsonlPath, agentId) {
  const result = [];
  try {
    const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
    const agentLabel = agentId ? extractAgentLabel(lines) : null;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'assistant') continue;
        const content = entry.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
          if (block.type !== 'tool_use') continue;
          result.push({
            tool: block.name,
            category: getCategory(block.name),
            timestamp: entry.timestamp || null,
            label: getLabel(block.name, block.input || {}),
            agentId: agentId || null,
            agentLabel: agentLabel || null
          });
        }
      } catch (_) {}
    }
  } catch (_) {}
  return result;
}

function collectFromDir(dirPath, maxFiles) {
  const result = [];
  let count = 0;
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (count >= maxFiles) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (e.isFile() && e.name.endsWith('.jsonl') && e.name !== 'journal.jsonl') {
        try {
          const stat = fs.statSync(full);
          if (stat.size > MAX_SUBAGENT_FILE_BYTES) { count++; continue; }
        } catch (_) { count++; continue; }
        result.push(...collectFromJsonl(full, e.name.replace('.jsonl', '')));
        count++;
      }
    }
  }
  walk(dirPath);
  return result;
}

module.exports = { collectFromJsonl, collectFromDir };
