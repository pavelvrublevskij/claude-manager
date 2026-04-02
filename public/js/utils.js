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
  init() {
    const saved = localStorage.getItem('claude-manager-theme') || 'dark';
    Theme.apply(saved);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    Theme.apply(next);
    localStorage.setItem('claude-manager-theme', next);
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerHTML = theme === 'dark' ? '&#9790;' : '&#9728;';
  }
};

// Apply theme immediately (before DOMContentLoaded) to avoid flash
Theme.init();

// --- Constants ---

const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
const KB_CONTEXTS = ['Chat', 'Global', 'Autocomplete', 'Settings', 'Confirmation', 'Tabs', 'Help', 'Transcript', 'HistorySearch', 'Task'];
const MCP_TYPES = ['stdio', 'sse', 'http'];
const VALUE_TYPES = ['string', 'number', 'boolean', 'object', 'array'];
