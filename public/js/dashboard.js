const Dashboard = {
  _grouping: 'recent',
  _activeGrouping: 'recent',
  _sessions: [],
  _activeSessions: [],

  async load() {
    showLoading('dashboard-stats');
    showLoading('dashboard-recent-sessions', 'Loading recent sessions...');
    try {
      const data = await api('/api/dashboard');
      Dashboard.renderStats(data.stats);
      Dashboard._activeSessions = data.activeSessions || [];
      Dashboard.renderActiveSessions(Dashboard._activeSessions);
      Dashboard._sessions = data.recentSessions;
      Dashboard._renderRecent();
    } catch (e) {
      toast('Could not load dashboard: ' + e.message, 'error');
    }
  },

  _applyGrouping(stateKey, btnPrefix, mode, renderFn) {
    Dashboard[stateKey] = mode;
    const r = document.getElementById(btnPrefix + '-recent');
    const p = document.getElementById(btnPrefix + '-project');
    if (r) r.classList.toggle('active', mode === 'recent');
    if (p) p.classList.toggle('active', mode === 'project');
    renderFn();
  },

  setGrouping(mode) {
    Dashboard._applyGrouping('_grouping', 'recent-group', mode, Dashboard._renderRecent);
  },

  setActiveGrouping(mode) {
    Dashboard._applyGrouping('_activeGrouping', 'active-group', mode, Dashboard._renderActiveCards);
  },

  _renderRecent() {
    if (Dashboard._grouping === 'project') {
      Dashboard._renderByProject(Dashboard._sessions, 'dashboard-recent-sessions');
    } else {
      Dashboard.renderRecentSessions(Dashboard._sessions);
    }
  },

  _renderActiveCards() {
    const container = document.getElementById('dashboard-active-sessions');
    if (Dashboard._activeGrouping === 'project') {
      Dashboard._renderByProject(Dashboard._activeSessions, 'dashboard-active-sessions');
    } else {
      Dashboard._renderCards(container, Dashboard._activeSessions);
    }
  },

  _renderByProject(sessions, containerId) {
    const container = document.getElementById(containerId);
    if (!sessions.length) {
      container.innerHTML = '<div class="empty-state"><p>No sessions</p></div>';
      return;
    }
    const groups = new Map();
    sessions.forEach(s => {
      const key = s.slug;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    container.innerHTML = [...groups.entries()].map(([slug, items]) => {
      const cards = items.map(s => renderSessionCard(s, {
        onclick: `App.navigate('session-detail', { slug: '${s.slug}', sessionId: '${s.sessionId}', sessionInfo: null })`,
        timeAgo: s.modified ? Dashboard.timeAgo(new Date(s.modified)) : '',
        slug: s.slug,
        dates: true,
        hasPlan: !!s.hasPlan
      })).join('');
      return `<div class="dashboard-project-group">
        <div class="dashboard-project-group-header" onclick="App.navigate('project-detail',{slug:'${slug}'})">${escapeHtml(decodeName(slug))}</div>
        <div class="dashboard-project-group-cards">${cards}</div>
      </div>`;
    }).join('');
  },

  renderActiveSessions(sessions) {
    const wrap = document.getElementById('dashboard-active-wrap');
    if (!wrap) return;
    if (!sessions.length) {
      wrap.style.display = 'none';
      document.getElementById('dashboard-active-sessions').innerHTML = '';
      return;
    }
    wrap.style.display = '';
    Dashboard._renderActiveCards();
  },

  _renderCards(container, sessions) {
    container.innerHTML = sessions.map(s => renderSessionCard(s, {
      onclick: `App.navigate('session-detail', { slug: '${s.slug}', sessionId: '${s.sessionId}', sessionInfo: null })`,
      project: decodeName(s.slug),
      timeAgo: s.modified ? Dashboard.timeAgo(new Date(s.modified)) : '',
      slug: s.slug,
      dates: true,
      hasPlan: !!s.hasPlan
    })).join('');
  },

  renderStats(stats) {
    const container = document.getElementById('dashboard-stats');
    const items = [
      { label: 'Projects', value: stats.projects, view: 'projects', icon: '&#128193;' },
      { label: 'Sessions', value: stats.sessions, icon: '&#128172;' },
      { label: 'Memory Files', value: stats.memoryFiles, icon: '&#128196;' },
      { label: 'MCP Servers', value: stats.mcpServers, view: 'mcp-servers', icon: '&#9889;' },
      { label: 'Skills', value: stats.skills, view: 'skills', icon: '&#9733;' },
      { label: 'Output Styles', value: stats.outputStyles, view: 'output-styles', icon: '&#9998;' },
      { label: 'Keybindings', value: stats.keybindings, view: 'keybindings', icon: '&#9000;' }
    ];

    container.innerHTML = items.map(item => `
      <div class="stat-card${item.view ? ' clickable' : ''}" ${item.view ? `onclick="App.navigate('${item.view}')"` : ''}>
        <div class="stat-card-icon">${item.icon}</div>
        <div class="stat-card-value">${item.value}</div>
        <div class="stat-card-label">${item.label}</div>
      </div>
    `).join('');
  },

  renderRecentSessions(sessions) {
    const container = document.getElementById('dashboard-recent-sessions');
    if (!sessions || !sessions.length) {
      container.innerHTML = '<div class="empty-state"><p>No recent sessions</p></div>';
      return;
    }
    Dashboard._renderCards(container, sessions);
  },

  timeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return date.toLocaleDateString();
  }
};
