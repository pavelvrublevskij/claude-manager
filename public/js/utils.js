// --- Shared Utilities ---

/** Escape HTML entities to prevent XSS. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Fetch JSON from the API. Throws on non-OK responses. */
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/** Show a toast notification. */
function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** Render markdown to HTML using the marked library. */
function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    return marked.parse(text || '');
  }
  return (text || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
}

/** Extract a human-readable short name from a project slug. */
function decodeName(slug) {
  const segments = slug.replace(/^[A-Za-z]--/, '').split('-').filter(Boolean);
  if (segments.length >= 2) {
    return segments.slice(-2).join('/');
  }
  return slug;
}

/** Show a loading spinner in a container element. */
function showLoading(container, text = 'Loading...') {
  if (typeof container === 'string') container = document.getElementById(container);
  container.innerHTML = `<div class="loading"><div class="spinner"></div>${escapeHtml(text)}</div>`;
}

// --- Theme ---

const Theme = {
  themes: ['dark', 'light', 'matrix', 'default'],
  icons: { dark: '&#9790;', light: '&#9728;', matrix: '&#9783;', default: '&#9681;' },
  labels: { dark: 'Dark', light: 'Light', matrix: 'Matrix', default: 'Default' },

  init() {
    const saved = localStorage.getItem('claude-manager-theme') || 'dark';
    Theme.apply(saved);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const idx = Theme.themes.indexOf(current);
    const next = Theme.themes[(idx + 1) % Theme.themes.length];
    Theme.apply(next);
    localStorage.setItem('claude-manager-theme', next);
  },

  apply(theme) {
    if (!Theme.themes.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const link = document.getElementById('theme-stylesheet');
    if (link) link.href = '/css/themes/' + theme + '.css';
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerHTML = Theme.icons[theme];
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.title = Theme.labels[theme] + ' mode';
  }
};

// Apply theme immediately (before DOMContentLoaded) to avoid flash
Theme.init();

const Changelog = {
  async load() {
    const el = document.getElementById('changelog-content');
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading changelog...</div>';
    try {
      const { content } = await api('/api/changelog');
      el.innerHTML = renderMarkdown(content);
    } catch (e) {
      el.innerHTML = '<p>Failed to load changelog.</p>';
      toast('Failed to load changelog', 'error');
    }
  }
};

/** Map a full model ID to a short display name. */
function shortModel(model) {
  if (!model) return '';
  // "claude-opus-4-6" -> "Opus 4.6", "claude-haiku-4-5-20251001" -> "Haiku 4.5"
  const m = model.replace(/-\d{8,}$/, '');
  const match = m.match(/claude-(opus|sonnet|haiku)-(.+)/i);
  if (match) {
    const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const ver = match[2].replace(/-/g, '.');
    return family + ' ' + ver;
  }
  return model;
}

/** Look up pricing for a model ID with fuzzy matching (strip date suffix, prefix match). */
function matchPricing(modelId, pricingMap) {
  if (!modelId || !pricingMap) return null;
  if (pricingMap[modelId]) return pricingMap[modelId];
  const noDate = modelId.replace(/-\d{8,}$/, '');
  if (pricingMap[noDate]) return pricingMap[noDate];
  let best = null, bestLen = 0;
  for (const key of Object.keys(pricingMap)) {
    if (modelId.startsWith(key) && key.length > bestLen) { best = key; bestLen = key.length; }
  }
  return best ? pricingMap[best] : null;
}

/** Format a token count to human-readable (e.g. 1.2M, 3.5K). */
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/**
 * Render a session card.
 * opts.onclick     - onclick handler string
 * opts.project     - show project badge (pass decoded project name)
 * opts.timeAgo     - show relative time in header (pass formatted string)
 * opts.dates       - show Created/Modified rows
 * opts.snippets    - HTML string for search snippets
 * opts.sidechain   - show sidechain/lastGitBranch indicators
 */
/**
 * Render session stat badges (messages, tokens, cost, models, branch, sidechain).
 * Shared between the session list card and the session detail header.
 * opts.sidechain - show sidechain/lastGitBranch indicators
 */
function renderSessionBadges(s, opts = {}) {
  const parts = [];
  if (s.messageCount != null) {
    parts.push(`<div class="meta-item">Messages <span class="meta-value">${s.messageCount}</span></div>`);
  }
  if (s.tokens) {
    const total = (s.tokens.input_tokens || 0) + (s.tokens.output_tokens || 0);
    parts.push(`<span class="token-badge badge-tokens">${fmtTokens(total)} tokens</span>`);
  }
  if (s.cost) {
    parts.push(`<span class="token-badge badge-cost">$${s.cost.toFixed(2)}</span>`);
  }
  (s.models || []).forEach(m => {
    parts.push(`<span class="token-badge badge-model">${escapeHtml(shortModel(m))}</span>`);
  });
  if (s.gitBranch) {
    parts.push(`<span class="session-branch">${escapeHtml(s.gitBranch)}</span>`);
  }
  if (opts.sidechain && s.lastGitBranch && s.lastGitBranch !== s.gitBranch) {
    parts.push(`<span class="session-branch" style="opacity:0.7">&#8594; ${escapeHtml(s.lastGitBranch)}</span>`);
  }
  if (opts.sidechain && s.isSidechain) {
    parts.push('<span class="session-sidechain">sidechain</span>');
  }
  return parts.join('');
}

function renderSessionCard(s, opts = {}) {
  const slug = opts.slug || s.slug;

  let headerHtml;
  if (opts.timeAgo) {
    headerHtml = `<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
      <div class="session-summary">${escapeHtml(s.summary || s.firstPrompt || 'Untitled session')}</div>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;margin-left:12px">${escapeHtml(opts.timeAgo)}</span>
    </div>`;
  } else {
    headerHtml = `<div class="session-summary">${escapeHtml(s.summary || s.firstPrompt || 'Untitled session')}</div>`;
    if (s.firstPrompt && s.summary) {
      headerHtml += `<div class="session-prompt">${escapeHtml(s.firstPrompt)}</div>`;
    }
  }

  return `
    <div class="session-card" style="cursor:pointer" data-session-id="${s.sessionId}" onclick="${opts.onclick || ''}">
      ${headerHtml}
      ${opts.snippets || ''}
      <div class="session-meta">
        ${opts.project ? `<span class="project-badge">${escapeHtml(opts.project)}</span>` : ''}
        ${opts.dates ? `<div class="meta-item">Created <span class="meta-value">${s.created ? new Date(s.created).toLocaleString() : '—'}</span></div>
        <div class="meta-item">Modified <span class="meta-value">${s.modified ? new Date(s.modified).toLocaleString() : '—'}</span></div>` : ''}
        ${renderSessionBadges(s, { sidechain: opts.sidechain })}
        <div class="session-actions">
          ${window.__docker ? '' : `<button class="btn btn-sm btn-primary session-resume-btn" onclick="event.stopPropagation(); Sessions.resume('${slug}', '${s.sessionId}')">Resume</button>`}
          <div class="action-menu">
            <button class="btn btn-sm action-menu-btn" onclick="event.stopPropagation(); Sessions.toggleActionMenu(this)" aria-label="More actions">&#8942;</button>
            <div class="action-menu-panel">
              <button class="action-menu-item" data-slug="${slug}" data-session="${s.sessionId}" data-title="${escapeHtml(s.summary || s.firstPrompt || '')}" onclick="event.stopPropagation(); Sessions.renameAction(this)">Rename</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Constants ---

const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
const KB_CONTEXTS = ['Chat', 'Global', 'Autocomplete', 'Settings', 'Confirmation', 'Tabs', 'Help', 'Transcript', 'HistorySearch', 'Task'];
const MCP_TYPES = ['stdio', 'sse', 'http'];
const VALUE_TYPES = ['string', 'number', 'boolean', 'object', 'array'];
