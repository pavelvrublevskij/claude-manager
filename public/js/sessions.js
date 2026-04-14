// --- Sessions ---

const Sessions = {
  cache: {},
  _searchSlug: null,
  _searchTimer: null,

  async load(slug) {
    Sessions._searchSlug = slug;
    const container = document.getElementById('sessions-list');
    showLoading(container, 'Loading sessions...');

    try {
      const sessions = await api(`/api/projects/${slug}/sessions`);
      Sessions.cache[slug] = sessions;
      Sessions.renderList(slug, sessions);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Could not load sessions</p></div>`;
    }
  },

  renderSearchBar(slug) {
    return `<div class="session-search-wrap">
      <input type="text" class="session-search" id="session-search-input"
        placeholder="Search sessions..." oninput="Sessions.onSearch('${slug}', this.value)">
      <button class="btn btn-sm btn-primary" onclick="Sessions.newSession('${slug}')">New Session</button>
    </div>`;
  },

  renderList(slug, sessions) {
    const container = document.getElementById('sessions-list');
    if (sessions.length === 0) {
      container.innerHTML = Sessions.renderSearchBar(slug) +
        '<div class="empty-state"><p>No sessions found</p></div>';
      return;
    }
    container.innerHTML = Sessions.renderSearchBar(slug) +
      sessions.map((s, i) => Sessions.renderCard(slug, s, i)).join('');
  },

  renderCard(slug, s, i) {
    const snippetsHtml = (s.snippets || []).map(sn => {
      const label = sn.label ? `<span class="snippet-label">${escapeHtml(sn.label)}</span> ` : '';
      const roleTag = sn.role === 'user' ? 'You' : sn.role === 'assistant' ? 'Claude' : '';
      const roleHtml = roleTag ? `<span class="snippet-role">${roleTag}</span> ` : '';
      return `<div class="session-snippet">${roleHtml}${label}${Sessions.highlightMatch(sn.text, Sessions._lastQuery)}</div>`;
    }).join('');
    return renderSessionCard(s, {
      onclick: `Sessions.open('${slug}', '${s.sessionId}', ${i})`,
      slug,
      dates: true,
      sidechain: true,
      snippets: snippetsHtml
    });
  },

  _lastQuery: '',

  highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const qEscaped = escapeHtml(query);
    const re = new RegExp('(' + qEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  },

  onSearch(slug, value) {
    clearTimeout(Sessions._searchTimer);
    const q = value.trim();
    Sessions._lastQuery = q;

    if (q.length < 2) {
      const cached = Sessions.cache[slug];
      if (cached) {
        const container = document.getElementById('sessions-list');
        const searchInput = document.getElementById('session-search-input');
        const cursorPos = searchInput?.selectionStart;
        container.innerHTML = Sessions.renderSearchBar(slug) +
          cached.map((s, i) => Sessions.renderCard(slug, s, i)).join('');
        const newInput = document.getElementById('session-search-input');
        if (newInput) { newInput.value = value; newInput.focus(); newInput.selectionStart = newInput.selectionEnd = cursorPos; }
      }
      return;
    }

    Sessions._searchTimer = setTimeout(async () => {
      try {
        const results = await api(`/api/projects/${slug}/sessions/search?q=${encodeURIComponent(q)}`);
        if (Sessions._lastQuery !== q) return;
        const container = document.getElementById('sessions-list');
        const searchInput = document.getElementById('session-search-input');
        const cursorPos = searchInput?.selectionStart;
        if (results.length === 0) {
          container.innerHTML = Sessions.renderSearchBar(slug) +
            '<div class="empty-state"><p>No sessions match your search</p></div>';
        } else {
          container.innerHTML = Sessions.renderSearchBar(slug) +
            results.map((s, i) => Sessions.renderCard(slug, s, i)).join('');
        }
        const newInput = document.getElementById('session-search-input');
        if (newInput) { newInput.value = value; newInput.focus(); newInput.selectionStart = newInput.selectionEnd = cursorPos; }
      } catch (e) {
        toast('Search failed', 'error');
      }
    }, 300);
  },

  open(slug, sessionId, index) {
    const sessions = Sessions.cache[slug] || [];
    App.navigate('session-detail', { slug, sessionId, sessionInfo: sessions[index] });
  },

  goBack() {
    const slug = App.currentProject;
    App.navigate('project-detail', { slug });
    const btn = document.getElementById('sessions-tab-btn');
    if (btn) btn.click();
  },

  detailState: { slug: null, sessionId: null, offset: 0, loading: false, hasMore: false, total: 0 },

  async loadDetail(slug, sessionId, info) {
    const title = document.getElementById('session-detail-title');
    const meta = document.getElementById('session-detail-meta');
    const container = document.getElementById('session-messages');

    title.textContent = info?.summary || info?.firstPrompt?.slice(0, 80) || 'Session';
    const created = info?.created ? new Date(info.created).toLocaleString() : '';
    const branch = info?.gitBranch || '';
    const models = (info?.models || []).map(m => `<span class="token-badge badge-model">${escapeHtml(shortModel(m))}</span>`).join('');
    meta.innerHTML = [created, branch ? `<span class="session-branch">${escapeHtml(branch)}</span>` : '', models].filter(Boolean).join(' &middot; ');

    Sessions.detailState = { slug, sessionId, offset: 0, loading: false, hasMore: false, total: 0 };
    container.innerHTML = '';

    await Sessions.loadMore();
    Sessions.setupScroll();
  },

  setupScroll() {
    const viewBody = document.querySelector('#view-session-detail .view-body');
    if (!viewBody) return;
    if (Sessions._scrollHandler) {
      viewBody.removeEventListener('scroll', Sessions._scrollHandler);
    }
    Sessions._scrollHandler = () => {
      if (Sessions.detailState.loading || !Sessions.detailState.hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = viewBody;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        Sessions.loadMore();
      }
    };
    viewBody.addEventListener('scroll', Sessions._scrollHandler);
  },

  async loadMore() {
    const state = Sessions.detailState;
    if (state.loading) return;
    state.loading = true;

    const container = document.getElementById('session-messages');

    // Show loader at bottom
    let loader = document.getElementById('session-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'session-loader';
      loader.className = 'loading';
      loader.innerHTML = '<div class="spinner"></div> Loading...';
    }
    container.appendChild(loader);

    try {
      const data = await api(`/api/projects/${state.slug}/sessions/${state.sessionId}?offset=${state.offset}&limit=20`);
      loader.remove();

      if (data.total === 0 && state.offset === 0) {
        container.innerHTML = '<div class="empty-state"><p>No messages in this session</p></div>';
        return;
      }

      state.total = data.total;
      state.hasMore = data.hasMore;
      state.offset += data.messages.length;

      const html = data.messages.map(m => Sessions.renderMessage(m)).join('');
      container.insertAdjacentHTML('beforeend', html);

      const countEl = document.getElementById('session-count');
      if (countEl) countEl.textContent = `Showing ${state.offset} of ${state.total} messages`;

      // Remove old load-more button
      const oldBtn = document.getElementById('load-more-btn');
      if (oldBtn) oldBtn.remove();

      if (data.hasMore) {
        const btn = document.createElement('button');
        btn.id = 'load-more-btn';
        btn.className = 'btn';
        btn.style.cssText = 'width:100%;margin-top:12px';
        btn.textContent = `Load more (${state.total - state.offset} remaining)`;
        btn.onclick = () => Sessions.loadMore();
        container.appendChild(btn);
      }
    } catch (e) {
      loader.textContent = 'Failed to load messages';
    } finally {
      state.loading = false;
    }
  },

  renderMessage(msg) {
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    let bodyHtml = '';

    for (const block of msg.content) {
      if (block.type === 'text') {
        bodyHtml += `<div class="chat-text">${renderMarkdown(block.text)}</div>`;
      } else if (block.type === 'tool_use') {
        const inputStr = JSON.stringify(block.input, null, 2);
        const toolId = 'tool-' + Math.random().toString(36).slice(2, 8);
        bodyHtml += `
          <div class="chat-tool">
            <div class="chat-tool-header" onclick="document.getElementById('${toolId}').classList.toggle('open')">
              &#9654; ${escapeHtml(block.name)}
            </div>
            <div class="chat-tool-body" id="${toolId}">${escapeHtml(inputStr)}</div>
          </div>
        `;
      } else if (block.type === 'tool_result') {
        if (block.text) {
          const resId = 'res-' + Math.random().toString(36).slice(2, 8);
          bodyHtml += `
            <div class="chat-tool-result">
              <div class="chat-tool-header" onclick="document.getElementById('${resId}').classList.toggle('open')">
                &#9654; Result
              </div>
              <div class="chat-tool-body" id="${resId}">${escapeHtml(block.text)}</div>
            </div>
          `;
        }
      }
    }

    return `
      <div class="chat-msg ${msg.role}">
        <div class="chat-role ${msg.role}">
          ${msg.role === 'user' ? 'You' : 'Claude'}
          ${msg.model && msg.role === 'assistant' ? `<span class="chat-model">${escapeHtml(shortModel(msg.model))}</span>` : ''}
          <span class="chat-time">${time}</span>
        </div>
        ${bodyHtml}
      </div>
    `;
  },

  async checkPricing() {
    try {
      await api('/api/pricing/fetch', { method: 'POST' });
    } catch (_) {
      toast('Pricing check failed — using cached data', 'error');
    }
  },

  async newSession(slug) {
    try {
      await Sessions.checkPricing();
      await api(`/api/projects/${slug}/sessions/new`, { method: 'POST' });
      toast('New session opened');
    } catch (e) {
      toast('Failed to open terminal: ' + e.message, 'error');
    }
  },

  async resume(slug, sessionId) {
    try {
      await Sessions.checkPricing();
      await api(`/api/projects/${slug}/sessions/${sessionId}/resume`, { method: 'POST' });
      toast('Terminal opened with session');
    } catch (e) {
      toast('Failed to open terminal: ' + e.message, 'error');
    }
  },

};
