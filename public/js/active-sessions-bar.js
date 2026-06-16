const ActiveSessionsBar = {
  POLL_MS: 15000,
  _timer: null,
  _sessions: [],

  start() {
    ActiveSessionsBar.poll();
    ActiveSessionsBar._timer = setInterval(ActiveSessionsBar.poll, ActiveSessionsBar.POLL_MS);
  },

  async poll() {
    try {
      const sessions = await api('/api/projects/active');
      ActiveSessionsBar._sessions = sessions || [];
      ActiveSessionsBar._render();
      ActiveSessionsBar._renderSidebar();
    } catch (_) {}
  },

  _render() {
    const bar = document.getElementById('active-sessions-bar');
    if (!bar) return;
    const sessions = ActiveSessionsBar._sessions;
    if (!sessions.length) {
      bar.style.display = 'none';
      return;
    }
    const inSession = typeof App !== 'undefined' && App.currentView === 'session-detail';
    const currentSessionId = inSession && typeof Sessions !== 'undefined' ? Sessions.detailState.sessionId : null;
    bar.style.display = 'flex';
    bar.innerHTML = sessions.map((s, i) => {
      const label = s.title || s.sessionId.slice(0, 12);
      const isCurrent = s.sessionId === currentSessionId;
      return `<div class="asb-pill${isCurrent ? ' asb-pill--current' : ''}" data-asb-idx="${i}" title="${escapeHtml(s.title || s.sessionId)}">
        <span class="session-active-dot session-active-dot--${s.kind}"></span>
        <div class="asb-text">
          <span class="asb-project">${escapeHtml(decodeName(s.slug))}</span>
          <span class="asb-session">${escapeHtml(label)}</span>
        </div>
        <button class="asb-close" data-asb-close="${i}" title="Close session" aria-label="Close">&#215;</button>
      </div>`;
    }).join('');
    bar.querySelectorAll('.asb-pill').forEach(el => {
      const idx = parseInt(el.dataset.asbIdx, 10);
      el.addEventListener('click', () => {
        const s = ActiveSessionsBar._sessions[idx];
        if (s) ActiveSessionsBar.open(s.slug, s.sessionId);
      });
    });
    bar.querySelectorAll('.asb-close').forEach(btn => {
      const idx = parseInt(btn.dataset.asbClose, 10);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const s = ActiveSessionsBar._sessions[idx];
        if (s) ActiveSessionsBar.close(s.slug, s.sessionId);
      });
    });
  },

  _renderSidebar() {
    document.querySelectorAll('.project-active-sub').forEach(el => el.remove());

    const bySlug = {};
    for (const s of ActiveSessionsBar._sessions) {
      if (!bySlug[s.slug]) bySlug[s.slug] = [];
      bySlug[s.slug].push(s);
    }

    const inSession = typeof App !== 'undefined' && App.currentView === 'session-detail';
    const currentSessionId = inSession && typeof Sessions !== 'undefined' ? Sessions.detailState.sessionId : null;
    for (const [slug, sessions] of Object.entries(bySlug)) {
      const navItem = document.querySelector(`.project-list .nav-item[data-slug="${slug}"]`);
      if (!navItem) continue;
      let anchor = navItem;
      for (const s of sessions) {
        const label = (s.title || s.sessionId.slice(0, 16)).slice(0, 28);
        const isCurrent = s.sessionId === currentSessionId;
        const div = document.createElement('div');
        div.className = 'nav-item project-active-sub' + (isCurrent ? ' active' : '');
        div.title = s.title || s.sessionId;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'asb-close asb-close--sidebar';
        closeBtn.title = 'Close session';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&#215;';
        closeBtn.addEventListener('click', (function(slug, sessionId) {
          return e => { e.stopPropagation(); ActiveSessionsBar.close(slug, sessionId); };
        }(s.slug, s.sessionId)));
        div.innerHTML = `<span class="session-active-dot session-active-dot--${s.kind}"></span><span class="nav-label">${escapeHtml(label)}</span>`;
        div.appendChild(closeBtn);
        div.addEventListener('click', (function(slug, sessionId) {
          return () => ActiveSessionsBar.open(slug, sessionId);
        }(s.slug, s.sessionId)));
        anchor.insertAdjacentElement('afterend', div);
        anchor = div;
      }
    }
  },

  async close(slug, sessionId) {
    try {
      await api(`/api/projects/${slug}/sessions/${sessionId}/deactivate`, { method: 'POST' });
    } catch (_) {}
    ActiveSessionsBar._sessions = ActiveSessionsBar._sessions.filter(
      s => !(s.slug === slug && s.sessionId === sessionId)
    );
    ActiveSessionsBar._render();
    ActiveSessionsBar._renderSidebar();
    if (typeof ActiveCount !== 'undefined') ActiveCount.refresh();
  },

  open(slug, sessionId) {
    if (typeof Sessions !== 'undefined') Sessions.stopAutoRefresh();
    if (typeof TerminalPanel !== 'undefined' && TerminalPanel.isOpen()) TerminalPanel.close();
    const cached = (typeof Sessions !== 'undefined' && Sessions.cache[slug]) || [];
    const info = cached.find(s => s.sessionId === sessionId) || null;
    App.navigate('session-detail', { slug, sessionId, sessionInfo: info });
  }
};
