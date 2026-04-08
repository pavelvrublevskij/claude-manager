## v0.3.1

### Bug Fixes
- Run scripts now launch server as a background process instead of blocking the terminal
- Terminal auto-closes after server starts and browser opens
- Server continues running after the launch terminal is closed
- Fix Skills view crashing when SKILL.md files have corrupt or unreadable content
- Wrap skills list routes in error handler for proper JSON error responses

## v0.3.0

### Themes
- Theme system with 4 built-in themes: Dark, Light, Matrix, Default (Catppuccin)
- Theme CSS extracted to individual files (`public/css/themes/`)
- Cycle through themes via sidebar button

### Session Search
- Full-text search across all session messages in a project
- Server-side search endpoint with context snippets and match highlighting
- Searches user messages, assistant responses, tool calls, and tool results

### Run Scripts
- One-click startup scripts (`run.sh`, `run.bat`) for all platforms
- Auto-installs Node.js if missing (via brew, apt, winget, choco, pacman, dnf)
- Kills previous instance on same port before starting
- Opens browser automatically after launch

### Project-Level Output Styles
- Browse, create, edit, and delete output styles scoped to individual projects
- New Output Styles tab in project detail view with count badge

### Settings Reference
- Inline reference panel for all Claude Code settings keys
- Covers general, permissions, sandbox, auto mode, hooks, and plugins
- Includes hook format documentation and links to official docs

### UI Improvements
- Version badge and update banner with remote version check
- Changelog view accessible from sidebar footer
- Session cards show git branch transitions (initial → latest)
- Sidechain session indicator badge

### Internal
- Consolidated duplicate `fmtTokens` helper to shared `utils.js`

## v0.2.1

### Pricing Fixes
- Updated model pricing to current Anthropic rates (Opus 4.6: $5/$25, Haiku 4.5: $1/$5)
- Fixed cost mismatch between summary and period breakdown (period aggregation now uses per-model rates)
- Added pricing verification date and source link to Anthropic docs

## v0.2.0

### Token Usage Statistics
- New **Token Usage** view with aggregated consumption and estimated costs
- Summary stat cards: input, output, cache write, cache read tokens with cost breakdown
- Usage breakdown by period (day, week, month, year) with visual cost bars
- Usage breakdown by project with session counts
- Pricing rates table (Claude Opus 4 API rates) with historical tracking
- Color-coded values across all stats, tables, and session cards
- Token and cost badges on session cards in project view
- File-based usage index (`data/usage-index.json`) with mtime caching for fast subsequent loads

### Project-Level Skills
- Browse, create, edit, and delete skills scoped to individual projects
- New Skills tab in project detail view

### UI Improvements
- Collapsible Projects section in sidebar navigation
- Color-coded stat cards and table columns for token types
- Token/cost badge styling for session cards
- `npm run dev` script for auto-reload during development

### Internal
- Extracted `lib/usage-index.js` shared module for token aggregation
- Added `lib/file-helpers.js` guards: `safeDataWrite()`, `writeDataJson()`
- Added `data/` directory for app-local storage (gitignored)
- Semver-aware version comparison for update check
- Added filesystem safety rule to CLAUDE.md

## v0.1.0

Initial release. Local web UI for managing Claude Code configuration:
- Settings editor (visual tree + raw JSON)
- Global and project CLAUDE.md with live preview
- MCP server management (global + project)
- Cloud integration display (read-only)
- Keybindings editor
- Skills management
- Output styles management
- Plugins viewer (read-only)
- Project memory CRUD with frontmatter
- Session browser with paginated conversation view
- Project settings and agents
- Dashboard with stats overview
- Dark/light theme
- Cross-platform (Windows, macOS, Linux)
