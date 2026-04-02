const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const BACKUPS_DIR = path.join(CLAUDE_DIR, 'backups');
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const MCP_FILE = path.join(CLAUDE_DIR, '.mcp.json');
const KEYBINDINGS_FILE = path.join(CLAUDE_DIR, 'keybindings.json');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const OUTPUT_STYLES_DIR = path.join(CLAUDE_DIR, 'output-styles');
const PLUGINS_DIR = path.join(CLAUDE_DIR, 'plugins');

module.exports = {
  CLAUDE_DIR, PROJECTS_DIR, BACKUPS_DIR, GLOBAL_CLAUDE_MD,
  SETTINGS_FILE, MCP_FILE, KEYBINDINGS_FILE,
  SKILLS_DIR, OUTPUT_STYLES_DIR, PLUGINS_DIR
};
