# Claude Manager

A local web UI for managing Claude Code configuration — settings, memory, MCP servers, keybindings, skills, output styles, sessions, and more.

Runs entirely on your machine. No cloud, no accounts, no external dependencies beyond Node.js.

## Quick Start

```bash
npm install
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Requirements

- Node.js 18+
- Claude Code installed (`~/.claude/` directory must exist)

## What It Manages

| Feature | Config File | Actions |
|---------|-------------|---------|
| **Settings** | `~/.claude/settings.json` | Visual tree editor + raw JSON |
| **CLAUDE.md** | `~/.claude/CLAUDE.md` | Markdown editor with live preview |
| **MCP Servers** | `~/.claude/.mcp.json` | Add, edit, enable/disable, delete |
| **Cloud Integrations** | (read-only) | View OAuth-connected services (Atlassian, etc.) |
| **Keybindings** | `~/.claude/keybindings.json` | Add contexts, map key combos to actions |
| **Skills** | `~/.claude/skills/*/SKILL.md` | Create, edit, delete custom slash commands |
| **Output Styles** | `~/.claude/output-styles/*.md` | Create, edit, delete response presets |
| **Plugins** | `~/.claude/plugins/` | View marketplaces and blocklist (read-only) |
| **Project Memory** | `~/.claude/projects/*/memory/` | CRUD memory files with frontmatter editor |
| **Sessions** | `~/.claude/projects/*/` | Browse session history, view conversations |
| **Project Settings** | `.claude/settings.local.json` | Edit local and shared project permissions |
| **Project MCP** | `.claude/.mcp.json` | Project-level MCP server config |
| **Project Agents** | `.claude/agents/*.md` | Create, edit, delete custom subagents |

## Architecture

```
server.js          # Express entry point (~30 lines)
lib/               # Shared server helpers
  paths.js         # Path constants
  file-helpers.js  # File I/O: backup, readJson, validation
  slug.js          # Project slug <-> filesystem path decoder
  frontmatter.js   # YAML frontmatter read/write helpers
routes/            # Express route modules (12 files)
public/
  index.html       # SPA shell
  css/style.css    # Dark theme
  js/
    utils.js       # Shared client utilities + constants
    modal.js       # Modal dialog factory
    app.js         # Navigation and routing
    [feature].js   # One file per UI feature
```

**Stack**: Express + vanilla JS. Two npm dependencies: `express` and `gray-matter`. No build step, no TypeScript, no framework.

## Cross-Platform

Works on Windows, macOS, and Linux. Path resolution handles all OS conventions automatically.

## Security

- Server binds to `127.0.0.1` only — never exposed to the network
- All file writes create a backup first
- Path traversal is prevented on all endpoints
- No credentials or secrets are ever written — only read for display
