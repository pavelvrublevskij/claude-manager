# Changelog

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
