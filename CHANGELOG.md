## v0.5.0

### Session Rename
- Display custom titles set via Claude Code's `/rename` command — reads `type: "custom-title"` entries from session JSONL files
- Rename sessions from Claude Manager via a new `⋮` action menu on session cards and the session detail header
- Server writes the new title as a `custom-title` line to the session JSONL (matching Claude Code's format) and also patches `sessions-index.json` when present
- Search now matches against custom titles and the scanned first prompt, not just index metadata — renamed sessions are findable by their new name

### UI
- Scroll-to-top button in the session detail view — appears after scrolling past ~400px, smoothly returns to the top on click
- Action menu (`⋮`) replaces the single Resume button with an extensible dropdown (Resume + Rename, ready for future actions)
- Project path in project cards and the project detail header is now clickable — opens the folder in the OS file explorer (Explorer on Windows, Finder on macOS, `xdg-open` on Linux). Disabled in Docker.

## v0.4.2

### Memory
- Memory tab button now shows the file count (e.g. `Memory (5)`)
- Export all memory files for a project as a `.zip` of the raw `.md` files
- Import memory files from a `.zip` — on conflict, prompts for confirmation before overwriting (backups are always created)

### Project Usage
- Project detail header now shows per-project token totals and cost (input, output, cache write/read, total cost)

## v0.4.0

### New Session Management
- New Session button in project sessions list — opens a new Claude terminal in the project directory
- Resume and New Session automatically check for pricing updates before launching
- Session back button now returns to the sessions list instead of the project overview
- In-session search — filter messages and highlight matches within a single session
- Auto-loads all messages when searching so the full session is covered

### AI Model Display
- Session cards show model badges (Opus, Sonnet, Haiku) with version numbers
- Session detail view shows model name on each assistant message
- Dashboard recent sessions include model badges
- Shared `renderSessionCard()` replaces duplicated card templates in dashboard and sessions

### Dynamic Pricing
- Auto-fetches model pricing from Anthropic on server startup (daily)
- Manual "Update Pricing" button in Token Usage view
- Pricing history with timestamped entries — only records when pricing actually changes
- Historical pricing used for cost calculations based on session dates
- Fuzzy model matching resolves session model IDs (e.g. `claude-haiku-4-5-20251001`) to pricing entries
- Fallback to built-in pricing when fetch is unavailable

### Manager Settings (new view)
- Pricing Fetch URL — configurable for when Anthropic changes their docs URL
- Pricing History table — browse all entries, view changes between them
- Manual pricing editor — add/edit/remove models with editable price fields
- Update existing history entries in-place to correct historical calculations
- Save as new entry for actual pricing changes
- Editable entry date for backdating corrections

### Docker Support
- Dockerfile and docker-compose.yml for containerized deployment
- Read-write volume mount for `~/.claude` with user confirmation prompt
- Run scripts (option 2 and 6) ask for permission before mounting with write access
- Persistent `app-data` volume for usage index and pricing history

### UI Restructure
- Sidebar reorganized into four sections: General, Claude Code, Projects, Claude Manager
- Claude Code section groups settings, CLAUDE.md, MCP, keybindings, skills, output styles, plugins
- Claude Manager section with Settings and Changelog (moved from footer)
- Session card meta items vertically centered

### Bug Fixes
- Fixed pricing page fetch failing on relative redirect URLs (307 with relative path)
- Fixed Token Usage showing $0.00 for models with date-suffixed IDs (fuzzy matching)
- Fixed pricing history reversed index loading wrong entry when clicked
- Removed session delete to preserve token usage calculation integrity

## v0.3.1

### Bug Fixes
- Run scripts now launch server as a background process instead of blocking the terminal
- Terminal auto-closes after server starts and browser opens
- Server continues running after the launch terminal is closed
- Fix Skills view crashing when SKILL.md files have corrupt or unreadable content
- Wrap skills list routes in error handler for proper JSON error responses
- Fix run.bat Node.js version check comparing minor version instead of major

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
