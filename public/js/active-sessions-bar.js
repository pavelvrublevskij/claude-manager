const ActiveSessionsBar = {
  POLL_MS: 15000,
  _timer: null,
  _sessions: [],
  _lastSidebarKey: null,

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

    const slugOrder = [];
    const bySlug = {};
    for (const s of sessions) {
      if (!bySlug[s.slug]) { bySlug[s.slug] = []; slugOrder.push(s.slug); }
      bySlug[s.slug].push(s);
    }

    bar.style.display = 'flex';
    bar.innerHTML = slugOrder.map(slug => {
      const group = bySlug[slug];
      const pills = group.map(s => {
        const label = s.title || s.sessionId.slice(0, 12);
        const isCurrent = s.sessionId === currentSessionId;
        return `<div class="asb-pill${isCurrent ? ' asb-pill--current' : ''}" data-asb-session="${escapeHtml(s.sessionId)}" data-asb-slug="${escapeHtml(s.slug)}" title="${escapeHtml(s.title || s.sessionId)}">
          <span class="session-active-dot session-active-dot--${s.kind}"></span>
          <span class="asb-session">${escapeHtml(label)}</span>
          <button class="asb-close" data-asb-close-session="${escapeHtml(s.sessionId)}" data-asb-close-slug="${escapeHtml(s.slug)}" title="Close session" aria-label="Close">&#215;</button>
        </div>`;
      }).join('');
      return `<div class="asb-group">
        <div class="asb-group-header">${escapeHtml(decodeName(slug))}</div>
        <div class="asb-group-sessions">${pills}</div>
      </div>`;
    }).join('');

    bar.querySelectorAll('.asb-pill').forEach(el => {
      el.addEventListener('click', () => ActiveSessionsBar.open(el.dataset.asbSlug, el.dataset.asbSession));
    });
    bar.querySelectorAll('[data-asb-close-session]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        ActiveSessionsBar.close(btn.dataset.asbCloseSlug, btn.dataset.asbCloseSession);
      });
    });
  },

  _renderSidebar() {
    const inSession = typeof App !== 'undefined' && App.currentView === 'session-detail';
    const currentSessionId = inSession && typeof Sessions !== 'undefined' ? Sessions.detailState.sessionId : null;
    const key = ActiveSessionsBar._sessions.map(s => s.slug + '|' + s.sessionId).join(',') + '|' + currentSessionId;
    if (key === ActiveSessionsBar._lastSidebarKey) return;
    ActiveSessionsBar._lastSidebarKey = key;

    document.querySelectorAll('.project-active-sub').forEach(el => el.remove());

    const bySlug = {};
    for (const s of ActiveSessionsBar._sessions) {
      if (!bySlug[s.slug]) bySlug[s.slug] = [];
      bySlug[s.slug].push(s);
    }

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
