const Dashboard = {
  async load() {
    showLoading('dashboard-stats');
    showLoading('dashboard-recent-sessions', 'Loading recent sessions...');
    try {
      const data = await api('/api/dashboard');
      Dashboard.renderStats(data.stats);
      Dashboard.renderRecentSessions(data.recentSessions);
    } catch (e) {
      toast('Could not load dashboard: ' + e.message, 'error');
    }
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
    if (sessions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No recent sessions</p></div>';
      return;
    }

    container.innerHTML = sessions.map(s => renderSessionCard(s, {
      onclick: `App.navigate('session-detail', { slug: '${s.slug}', sessionId: '${s.sessionId}', sessionInfo: null })`,
      project: decodeName(s.slug),
      timeAgo: s.modified ? Dashboard.timeAgo(new Date(s.modified)) : '',
      slug: s.slug
    })).join('');
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
