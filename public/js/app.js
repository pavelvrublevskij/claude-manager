// --- Navigation & App Shell ---

const SIDEBAR_COLLAPSED_KEY = 'claude-manager-sidebar-collapsed';

const App = {
  currentView: 'dashboard',
  currentProject: null,

  init() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        App.navigate(item.dataset.view);
      });
    });

    // Restore sidebar collapsed state
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
      document.querySelector('.app').classList.add('sidebar-collapsed');
      const btn = document.getElementById('sidebar-toggle');
      if (btn) btn.textContent = '›';
    }

    // Load projects first (needed for sidebar nav and routing)
    Projects.load().then(() => {
      // Restore route from hash or default to settings
      App.restoreRoute();
    });

    // Listen for back/forward
    window.addEventListener('hashchange', () => App.restoreRoute());
  },

  toggleSidebar() {
    const app = document.querySelector('.app');
    const btn = document.getElementById('sidebar-toggle');
    const collapsed = app.classList.toggle('sidebar-collapsed');
    btn.textContent = collapsed ? '›' : '‹';
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  },

  // Build hash from current state
  setHash(view, opts = {}) {
    let hash = '#' + view;
    if (opts.slug) hash += '/' + opts.slug;
    if (opts.sessionId) hash += '/' + opts.sessionId;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  },

  restoreRoute() {
    const hash = window.location.hash.slice(1); // remove #
    if (!hash) {
      App.navigate('dashboard');
      return;
    }
    const parts = hash.split('/');
    const view = parts[0];
    const slug = parts[1] || null;
    const sessionId = parts[2] || null;

    if (view === 'session-detail' && slug && sessionId) {
      // Find session info from cache if available
      const sessions = Sessions.cache[slug] || [];
      const info = sessions.find(s => s.sessionId === sessionId);
      App.navigate('session-detail', { slug, sessionId, sessionInfo: info }, true);
    } else if (view === 'project-detail' && slug) {
      App.navigate(view, { slug }, true);
    } else {
      App.navigate(view, {}, true);
    }
  },

  navigate(view, opts = {}, fromHash = false) {
    // Stop auto-refresh + close in-page terminal when leaving session-detail
    if (App.currentView === 'session-detail' && view !== 'session-detail') {
      if (typeof Sessions !== 'undefined') Sessions.stopAutoRefresh();
      if (typeof TerminalPanel !== 'undefined' && TerminalPanel.isOpen()) TerminalPanel.close();
    }

    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Activate clicked nav item
    const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');

    // Hide all views, show target
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    App.currentView = view;

    // Simple views with direct ID mapping
    const simpleViews = {
      'dashboard': () => Dashboard.load(),
      'usage': () => Usage.load(),
      'settings': () => Settings.load(),
      'global-claude-md': () => ClaudeMd.loadGlobal(),
      'projects': () => Projects.load(),
      'mcp-servers': () => McpServers.load(),
      'keybindings': () => Keybindings.load(),
      'skills': () => Skills.load(),
      'output-styles': () => OutputStyles.load(),
      'plugins': () => Plugins.load(),
      'manager-settings': () => ManagerSettings.load(),
      'changelog': () => Changelog.load()
    };

    if (simpleViews[view]) {
      document.getElementById('view-' + view).classList.add('active');
      simpleViews[view]();
    } else if (view === 'project-detail') {
      document.getElementById('view-project-detail').classList.add('active');
      App.currentProject = opts.slug;
      ProjectNav.expand();
      // Reset to memory tab
      document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-memory').classList.add('active');
      document.querySelectorAll('#view-project-detail .tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('memory-tab-btn').classList.add('active');
      Memory.load(opts.slug);
      // Show counts on tabs
      const project = Projects.data.find(p => p.slug === opts.slug);
      const memoryTabBtn = document.getElementById('memory-tab-btn');
      if (memoryTabBtn) {
        const count = project ? project.memoryCount : 0;
        memoryTabBtn.textContent = count > 0 ? `Memory (${count})` : 'Memory';
      }
      const sessionsTabBtn = document.getElementById('sessions-tab-btn');
      if (sessionsTabBtn) {
        const count = project ? project.sessionCount : 0;
        sessionsTabBtn.style.display = count > 0 ? '' : 'none';
        sessionsTabBtn.textContent = count > 0 ? `Sessions (${count})` : 'Sessions';
      }
      const skillsTabBtn = document.getElementById('skills-tab-btn');
      if (skillsTabBtn) {
        const count = project ? project.skillsCount : 0;
        skillsTabBtn.textContent = count > 0 ? `Skills (${count})` : 'Skills';
      }
      const stylesTabBtn = document.getElementById('output-styles-tab-btn');
      if (stylesTabBtn) {
        const count = project ? project.outputStylesCount : 0;
        stylesTabBtn.textContent = count > 0 ? `Output Styles (${count})` : 'Output Styles';
      }
      // Load per-project token usage in header
      ProjectUsage.load(opts.slug);
      // Highlight in sidebar
      document.querySelectorAll('.project-list .nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.slug === opts.slug);
      });
    } else if (view === 'session-detail') {
      document.getElementById('view-session-detail').classList.add('active');
      App.currentProject = opts.slug;
      Sessions.loadDetail(opts.slug, opts.sessionId, opts.sessionInfo);
    }

    // Update URL hash
    if (!fromHash) {
      App.setHash(view, opts);
    }
  }
};

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  const hostEl = document.getElementById('footer-host');
  if (hostEl) hostEl.textContent = location.host;
  api('/api/version').then(data => {
    window.__docker = !!data.docker;
    const av = document.getElementById('app-version');
    if (av) av.textContent = 'v' + data.version;
    const fv = document.getElementById('footer-version');
    if (fv) fv.textContent = 'v' + data.version;
    if (data.updateAvailable) {
      const banner = document.getElementById('update-banner');
      banner.innerHTML = `New version <strong>v${escapeHtml(data.latest)}</strong> available!
        <a href="https://github.com/pavelvrublevskij/claude-manager" target="_blank">View on GitHub</a>`;
      banner.style.display = 'block';
    }
  }).catch(() => {});
});

window.setFooterStatus = function(text, live) {
  const el = document.getElementById('footer-status');
  if (!el) return;
  el.textContent = text || 'Idle';
  el.classList.toggle('live', !!live);
};
