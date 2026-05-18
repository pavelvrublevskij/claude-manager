## v1.0.1

### Bug fixes

- **Plan detection false positives**: replaced the ±30-minute mtime overlap heuristic with exact content matching — plans are now linked to sessions via the `ExitPlanMode` tool call's `planFilePath`; unrelated plan files no longer appear under a session
- **Session titles show `/clear` or system caveat text**: sessions that start with a `/clear` command or the "Caveat: The messages below were generated…" system message now skip those entries and surface the first real user message as the title
- **Skill invocations shown with raw XML**: session cards whose first prompt was a skill call (e.g. `/review`) were rendering the raw `<command-name>` XML wrapper; they now show a styled `/skill` badge
- **Active-session badge hidden in collapsed sidebar**: the green count badge was clipped by overflow in icon-only sidebar mode; fixed with absolute positioning
- **Plan badge duplicated on session cards**: plan annotation could fire from two code paths, inserting the badge twice; refactored to use the server-provided `hasPlan` flag with a single `_rerenderPlans()` pass
- **Session detail missing project context**: added a clickable project chip in the session detail header so you can navigate back to the project without using the browser back button

## v1.0.0

### Browser terminals run in background

- Leaving a session no longer kills the browser terminal pty — it keeps running. Returning to the session reattaches and replays the last 256 KB of output
- A modal on leaving a session lets you choose **Run in background** or **Close session**
- New browser sessions with no input yet are closed immediately on leave (no orphan ptys)

### Active-session indicators

- Green pulsing dot on session cards marks sessions that are still running — **solid** for browser-terminal ptys, **outlined** for recent OS-terminal launches
- **Active count badges** on the Dashboard nav item and each project in the sidebar; updates every 15s
- Sessions list refreshes automatically when navigating back so dots reflect current state
- **Remote-controlled marker** — a phone icon appears on session cards that were ever driven via the mobile/web bridge

### Themes

- Three new themes: **Terminal** (amber CRT), **Dracula** (purple/pink dark), **Sepia** (warm paper light)
- Theme picker added to **Manager Settings → General** as a dropdown — alongside the existing footer toggle that cycles all 7 themes

### UX

- Navigating back from a session lands on the **Sessions** tab instead of resetting to Memory
- Favicon added — replaces the "CM" text in the footer

## v0.9.1

### Bug fixes

- **Usage charts empty state**: "No data / No model usage / No project usage" messages were visible even when data was present — author CSS `display: flex` on `.chart-empty` overrode the HTML `hidden` attribute; fixed by adding `[hidden] { display: none !important; }` to the global stylesheet
- **Usage charts timezone**: period grouping (day/hour labels) was bucketed in UTC instead of local time, causing data to appear shifted by the UTC offset; index now uses local time methods and reindexes automatically
- **Dashboard session cards**: created/modified dates were not shown on dashboard session cards
- **Dashboard session cards**: "just now" time label was obscured by the `⋮` action menu button; fixed by increasing session card right padding to clear the absolutely-positioned button

## v0.9.0

### Removed

- **Docker support dropped** — Dockerfile, docker-compose.yml, and .dockerignore deleted; Docker-specific server guards and client conditionals removed

### Run scripts

- **Stop** option (2) — kills the running server process by port
- **Update (git)** option (3) — `git pull` + `npm install`
- **Update (zip)** option (4) — fetches the latest release zip from GitHub, extracts, copies files, and reinstalls deps

### Auto-update from UI

- Version update banner now includes an **Update now** link — downloads the latest release zip, applies it in-place, runs `npm install`, auto-restarts the server, and reloads the page; no manual restart needed
- Update endpoint checks that the fetched version is actually newer before downloading anything

### Bug fixes

- **File Changes — files not shown**: `null.split('@')` threw on newly created files (no pre-existing backup), causing the entire snapshot entry to be skipped — fixed with a null guard
- **File Changes — plans disappear on refresh**: plans were skipped when `?from`/`?to` params were absent (no session cache on page refresh) — server now falls back to timestamps extracted from the session JSONL
- **Conversation ANSI codes**: ANSI escape sequences (e.g. `ESC[2m`) now stripped before markdown rendering — no more raw control characters in message output

### Refactor

- Frontend and server code split into focused modules for reusability (`session-context.js`, `session-messages.js`, `session-search.js`, `usage-filters.js`, `crud-frontmatter.js`, `date-filter.js`, `project-mcp-tab.js`, `project-settings-tab.js`)
- Test coverage added: unit tests for lib utilities (`lib-utils.test.js`) and integration tests for file history and plans endpoints (`file-history.test.js`, `plans.test.js`)

### UI

- **Footer**: theme toggle moved from sidebar header to footer — shows current theme name with `Theme:` label; cycles through all 4 themes on click
- **Sidebar**: removed header block (logo + toggle); nav starts at top
- **Token Usage**: now the default view and first item in sidebar nav
- **Onboarding tour**: 6-step spotlight walkthrough on first load — covers navigation, usage summary, filters, table/charts toggle, and period breakdown; re-triggers automatically when the minor version increments; skippable at any step
- **Cache terminology**: "Cache Read" renamed to "Cache Hits & Refreshes" (stat card) / "Cache Hits" (table columns, charts, badges) to match Claude's official terminology

## v0.8.2

### Bug fixes

- **Modal overflow**: modals now scroll when content exceeds viewport height (`max-height: 90vh`, flex layout, `.modal-body` with `overflow-y: auto`)
- **File Changes — diff vs current**: replaced version-pair filter pills with a direct "snapshot vs current file" model — clicking a file diffs its first recorded snapshot against the live file on disk; new `/diff-current` endpoint handles the comparison
- **Terminal Ctrl+V**: removed clipboard-to-WebSocket paste (key is consumed but no longer reads from clipboard — terminal handles paste natively)

## v0.8.1

### Bug fixes

- **Conversation scroll**: fixed — `min-height: 0` added to `session-messages-wrap` and `session-messages-pane` so the flex layout properly constrains the pane height and `overflow-y: auto` triggers
- **File Changes panel bleed**: `pollContext` (called on every auto-refresh) was forcing the file-changes panel visible even when the user was on the Conversation tab, stealing height and breaking scroll — fixed by letting `switchTab` be the sole owner of panel visibility
- **New session in browser**: replaced the small popup terminal modal with the full in-page terminal panel — new sessions now open in the same split view as resumed sessions, with auto-discovery polling that detects the new session and starts live message refresh automatically
- **Terminal modal window size**: removed the now-unused `TerminalModal` and its CSS

## v0.8.0

### Session Detail — File Changes & Plans

- New **File Changes / Conversation** tab bar in session detail view — File Changes is the default tab
- If a session has no file history or plans, the view auto-switches to Conversation
- **Files edited**: version filter pills (v1→v2, v2→v3, …) at the top; clicking filters the file list to only files changed in that version; clicking a file opens the diff modal
- File list sortable: **Default** / **A→Z** / **Z→A**
- **Plans**: sessions show any plan files whose mtime overlaps the session's time window (±30 min)
- Clicking a plan opens it in a markdown modal
- Session cards in the sessions list show a **plan** badge for sessions with associated plans

### Code cleanup

- Removed global Plans and File History sidebar views and project tabs — all functionality now lives in session detail
- Dead code removed: `plans.js`, `ProjectPlans`, `ProjectFileHistory` (~400 lines)
- `routes/file-history.js` and `routes/plans.js` trimmed to only the endpoints still in use

### TODO

- File Changes: show full file content for first snapshot (v1 — no previous version to diff against)
- Plans: display plan name alongside session card badge (tooltip or inline)
- File Changes: show timestamp per version so user knows when each edit happened
- Session context: allow navigating to a related session directly from its plan row

## v0.7.3

### Token Usage
- From / To filters are now datetime pickers — filter by date and time of day
- New **Hour** group in the period breakdown tabs

### Sessions
- Branch display: all branches shown (removed +N overflow), each on its own line below the model/cost badges
- Session detail header: per-model cost breakdown — each model badge shows its individual cost

### App
- Footer: "Raise Issue" link opens GitHub Issues in a new tab

## v0.7.2

### Session Conversation
- Bug fix: multi-line user messages now display all lines (single newlines were collapsed by the Markdown renderer)

### In-Session Terminal
- Ctrl+C copies selected text to clipboard (when text is selected); passes through as SIGINT otherwise
- Ctrl+V pastes from clipboard into the terminal
- "Copied" toast confirmation when text is copied

## v0.7.1

### Token Usage — Charts

- Bug fix: charts did not show today's data on initial page load or after clicking Refresh
- Bug fix: changing the date range preset (e.g. "Today", "Last 7 days") now auto-selects an appropriate period grouping — Today/7d/30d/Month → Day, Year/All time → Month

### Session Conversation — Tool Use Display

- Tool calls now show a key parameter inline in the header (filename, command, pattern, etc.) without needing to expand
- `Edit` tool renders a structured before/after diff view instead of raw JSON
- `Bash` tool shows the command in a code block; `Read`/`Write`/`Glob`/`Grep`/`Agent`/`WebFetch`/`WebSearch` each have tailored displays

## v0.7.0

### Sidebar
- Collapsible to compact icon-only mode (48 px) — labels hidden, icons remain, native tooltips on hover
- Toggle strip on the divider line; state persisted across page refreshes

### Sessions
- Period filter (Today / Last 7 days / etc.) now also filters the session list, not only the usage bar
- Sessions tab label shows filtered count `(n/total)` when a period or date range is active
- Bug fix: clicking a search result opened the wrong session (index was relative to search results, not the full cache)

### App
- Footer version badge was silently broken (missing element reference stopped the version from rendering)

## v0.6.0

### In-Session Terminal
- In-page terminal panel on the session detail view (xterm.js + node-pty + WebSocket)
- Pane is always visible in the session view; `Open Terminal` button lives inside it
- Auto-opens on subsequent sessions once enabled
- Splitter click toggles conversation hide/show; drag resizes; persisted width
- Restart icon, OS-terminal launch moved to the action menu
- Single active terminal per `(slug, sessionId)` — duplicate connection is rejected with a notice
- `Resume in OS Terminal` disconnects any in-page terminal for the same session
- Warning note in the pane: keep one terminal per session
- Bug fix: silent server abort caused by double `term.kill()` on Windows ConPTY (idempotent termination)
- Top-level `uncaughtException` / `unhandledRejection` safety net on the server

### Conversation
- Auto-refresh every 5s while open; instant refresh on show; paused while hidden
- Refresh rate configurable in Manager Settings (min 1s)
- Removed manual Refresh button (auto-refresh covers it)

### Token Usage
- New **Charts** view: Cost & Tokens over Time, Cost by Model, Top Projects by Cost
- Theme-aware, respects existing filters
- Default period: **This month**; new **Today** option

### Sessions
- Cards show full branch chain (every branch the session touched)
- New `gitBranches` field on list / search / dashboard recents APIs
- Scroll-to-top button now lives inside the conversation pane (no longer overlaps the footer or terminal)

### App
- Sticky app footer (version, host, live status indicator)
- Manager Settings: vertical-nav layout (General / Pricing Source / Pricing History / Model Pricing)

## v0.5.3

### Session ID
- Session ID is now visible at a glance — short truncated badge in every session card's meta row, click to copy the full ID
- Session detail header shows the full session ID under the title with a dedicated **Copy** button
- New **Copy session ID** action in the `⋮` menu, both on session cards and the detail header
- New shared `copyToClipboard()` helper — uses the modern Clipboard API with a textarea fallback for non-secure contexts

## v0.5.2

No new features, just quality improvement to have tests.

## v0.5.1

### Token Usage Filters
- New filter bar at the top of the Token Usage view replaces the per-row filter buttons and floating pills
- Multi-select **Models** and **Projects** dropdowns with search — pick any combination
- **Period** selector with presets (Last 7 / 30 days, This month, This year, All time) plus custom From/To date pickers; presets populate the date inputs, and editing a date switches the preset to Custom
- **Clear all** button resets every filter in one click
- Project names render as basenames with the full path preserved as a hover tooltip; dropdown search matches basenames, not full paths

### Project Detail
- Period/date filter above the per-project usage strip — same presets and custom range as the main Usage view; filters the project totals on the fly

### Fixes
- Token formatter now renders values above 1 billion as e.g. `1.0B` instead of overflowing into `1035.6M`

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
