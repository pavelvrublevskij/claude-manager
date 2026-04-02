# Claude Manager

Local web UI for managing Claude Code configuration files (~/.claude/).

## Architecture

- **Server**: Node.js/Express. Entry point `server.js` (~30 lines) mounts route modules.
  - `lib/` — shared helpers: path constants, file I/O, slug decoding, frontmatter parsing
  - `routes/` — one file per API group (12 files), each exports an Express Router
- **Client**: Vanilla JS SPA, no build step, no framework. All scripts load via `<script>` tags.
  - `public/js/utils.js` — shared utilities loaded first (escapeHtml, api, toast, renderMarkdown, constants)
  - `public/js/modal.js` — modal factory loaded second
  - Feature modules: one file per UI feature (settings, memory, sessions, mcp-servers, etc.)
  - `public/js/app.js` — navigation shell, loaded last (references all feature modules)
- **Styling**: Single CSS file (`public/css/style.css`), dark mode, CSS custom properties for theming

## Conventions

- Client modules are singleton objects on window scope (e.g., `McpServers`, `Skills`)
- No ES modules, no classes — plain object literals (singletons don't benefit from classes)
- Modals use `openModal({ title, body, buttons })` factory from modal.js
- Form helpers: `formGroup(label, html)`, `formRow(...)`, `selectHtml(id, options, selected)`
- Constants defined in utils.js: `MEMORY_TYPES`, `KB_CONTEXTS`, `MCP_TYPES`, `VALUE_TYPES`
- Server route handlers wrapped in `wrapRoute()` for standardized error handling
- Server helpers: `readJson()`, `backup()`, `readFrontmatterFile()`, `readFrontmatterDir()`, `writeFrontmatter()`

## Key Patterns

- All client API calls go through `api(url, opts)` which returns parsed JSON or throws
- Error display: `toast(message, 'error')` — never silent catch on client side
- Server routes: thin handlers using lib/ helpers, always return JSON
- File operations: always `backup()` before write/delete
- Hash-based routing: URL reflects current view, survives page refresh
- Scroll-based pagination: sessions load 20 messages at a time

## File Operations Safety

- All writes create a backup in `~/.claude/backups/` first
- Path traversal prevented via `safeSlug()` and `safeMemoryFile()` validators
- Server binds to 127.0.0.1 only — no network exposure
- Credentials file (`.credentials.json`) is read-only for cloud MCP display, never written

## Don't

- Add a build step or TypeScript
- Add frameworks (React, Vue, etc.)
- Use ES6 import/export (no build step = script tags)
- Create classes for singletons
- Add comments to obvious code — the structure is self-documenting
- Commit `.claude/` directory (local permissions, not for repo)
