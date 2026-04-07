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

/** Format a token count to human-readable (e.g. 1.2M, 3.5K). */
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// --- Constants ---

const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
const KB_CONTEXTS = ['Chat', 'Global', 'Autocomplete', 'Settings', 'Confirmation', 'Tabs', 'Help', 'Transcript', 'HistorySearch', 'Task'];
const MCP_TYPES = ['stdio', 'sse', 'http'];
const VALUE_TYPES = ['string', 'number', 'boolean', 'object', 'array'];
