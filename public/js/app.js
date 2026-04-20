// --- Navigation & App Shell ---

const App = {
  currentView: 'dashboard',
  currentProject: null,

  init() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        App.navigate(item.dataset.view);
      });
    });

    // Load projects first (needed for sidebar nav and routing)
    Projects.load().then(() => {
      // Restore route from hash or default to settings
      App.restoreRoute();
    });

    // Listen for back/forward
    window.addEventListener('hashchange', () => App.restoreRoute());
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
  api('/api/version').then(data => {
    window.__docker = !!data.docker;
    document.getElementById('app-version').textContent = 'v' + data.version;
    if (data.updateAvailable) {
      const banner = document.getElementById('update-banner');
      banner.innerHTML = `New version <strong>v${escapeHtml(data.latest)}</strong> available!
        <a href="https://github.com/pavelvrublevskij/claude-manager" target="_blank">View on GitHub</a>`;
      banner.style.display = 'block';
    }
  }).catch(() => {});
});
