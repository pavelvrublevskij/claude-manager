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
      ${window.__docker ? '' : `<div class="action-menu">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Sessions.toggleActionMenu(this)">New Session &#9662;</button>
        <div class="action-menu-panel">
          <button class="action-menu-item" onclick="event.stopPropagation(); Sessions.newSessionOS('${slug}')">In OS terminal</button>
          <button class="action-menu-item" onclick="event.stopPropagation(); Sessions.newSessionBrowser('${slug}')">In browser terminal</button>
        </div>
      </div>`}
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
      const roleHtml = roleTag ? `<span class="snippet-role snippet-role-${sn.role}">${roleTag}</span> ` : '';
      return `<div class="session-snippet snippet-${sn.role}">${roleHtml}${label}${Sessions.highlightMatch(sn.text, Sessions._lastQuery)}</div>`;
    }).join('');
    const cached = Sessions.cache[slug] || [];
    const correctIndex = cached.findIndex(x => x.sessionId === s.sessionId);
    return renderSessionCard(s, {
      onclick: `Sessions.open('${slug}', '${s.sessionId}', ${correctIndex >= 0 ? correctIndex : i})`,
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
    Sessions.stopAutoRefresh();
    if (typeof TerminalPanel !== 'undefined' && TerminalPanel.isOpen()) TerminalPanel.close();
    const sessions = Sessions.cache[slug] || [];
    App.navigate('session-detail', { slug, sessionId, sessionInfo: sessions[index] });
  },

  goBack() {
    Sessions.stopAutoRefresh();
    if (typeof TerminalPanel !== 'undefined' && TerminalPanel.isOpen()) TerminalPanel.close();
    const slug = App.currentProject;
    App.navigate('project-detail', { slug });
    const btn = document.getElementById('sessions-tab-btn');
    if (btn) btn.click();
  },

  detailState: { slug: null, sessionId: null, offset: 0, loading: false, hasMore: false, total: 0 },
  REFRESH_INTERVAL_KEY: 'claude-manager-conversation-refresh-ms',
  REFRESH_INTERVAL_DEFAULT_MS: 5000,
  REFRESH_INTERVAL_MIN_MS: 1000,
  CONVERSATION_HIDDEN_KEY: 'claude-manager-conversation-hidden',
  SHOW_TOOL_DETAILS_KEY: 'claude-manager-show-tool-details',
  _refreshTimer: null,

  refreshIntervalMs() {
    const raw = parseInt(localStorage.getItem(Sessions.REFRESH_INTERVAL_KEY), 10);
    if (Number.isFinite(raw) && raw >= Sessions.REFRESH_INTERVAL_MIN_MS) return raw;
    return Sessions.REFRESH_INTERVAL_DEFAULT_MS;
  },

  setRefreshIntervalMs(ms) {
    if (!Number.isFinite(ms) || ms < Sessions.REFRESH_INTERVAL_MIN_MS) return false;
    localStorage.setItem(Sessions.REFRESH_INTERVAL_KEY, String(ms));
    if (Sessions._refreshTimer && !Sessions.isConversationHidden()) Sessions.startAutoRefresh();
    return true;
  },

  isConversationHidden() {
    return localStorage.getItem(Sessions.CONVERSATION_HIDDEN_KEY) === '1';
  },

  applyConversationHiddenState() {
    const body = document.getElementById('session-detail-body');
    if (body) body.classList.toggle('conversation-hidden', Sessions.isConversationHidden());
  },

  showToolDetails() {
    return localStorage.getItem(Sessions.SHOW_TOOL_DETAILS_KEY) === '1';
  },

  applyToolDetailsState() {
    const container = document.getElementById('session-messages');
    if (container) container.classList.toggle('tools-hidden', !Sessions.showToolDetails());
    const checkbox = document.getElementById('session-detail-show-tools');
    if (checkbox) checkbox.checked = Sessions.showToolDetails();
  },

  setShowToolDetails(checked) {
    localStorage.setItem(Sessions.SHOW_TOOL_DETAILS_KEY, checked ? '1' : '0');
    Sessions.applyToolDetailsState();
    Sessions.updateMessageCount();
    if (Sessions._detailSearchQuery) Sessions.applyDetailFilter(Sessions._detailSearchQuery);
  },

  updateMessageCount() {
    const countEl = document.getElementById('session-count');
    if (!countEl) return;
    const state = Sessions.detailState;
    if (!state.total) { countEl.textContent = ''; return; }
    const container = document.getElementById('session-messages');
    const showTools = Sessions.showToolDetails();
    const toolOnly = container ? container.querySelectorAll('.chat-msg-tools-only').length : 0;
    if (!showTools && toolOnly) {
      const visible = state.offset - toolOnly;
      countEl.textContent = `Showing ${visible} of ${state.total} messages (${state.offset} with tool details)`;
    } else {
      countEl.textContent = `Showing ${state.offset} of ${state.total} messages`;
    }
  },

  renderDetailMeta(stats) {
    const meta = document.getElementById('session-detail-meta');
    if (!meta) return;
    const info = Sessions._detailInfo || {};
    const merged = Object.assign({}, info, stats || {});

    // Fill title from stats when navigated without info (e.g. from dashboard)
    const title = document.getElementById('session-detail-title');
    if (title && title.textContent === 'Session' && (merged.summary || merged.firstPrompt)) {
      const titleText = merged.summary || merged.firstPrompt.slice(0, 80);
      title.textContent = titleText;
      title.title = titleText;
    }

    const createdHtml = merged.created
      ? `<div class="meta-item">Created <span class="meta-value">${new Date(merged.created).toLocaleString()}</span></div>`
      : '';
    meta.innerHTML = createdHtml + renderSessionBadges(merged, { sidechain: true });
  },

  async loadDetail(slug, sessionId, info) {
    const title = document.getElementById('session-detail-title');
    const container = document.getElementById('session-messages');

    const titleText = info?.summary || info?.firstPrompt?.slice(0, 80) || 'Session';
    title.textContent = titleText;
    title.title = titleText;
    Sessions._detailInfo = info || {};
    Sessions.renderDetailMeta(null);

    const idValue = document.getElementById('session-detail-id-value');
    if (idValue) {
      idValue.textContent = sessionId || '';
      idValue.style.display = sessionId ? 'inline-block' : 'none';
    }

    Sessions.detailState = { slug, sessionId, offset: 0, loading: false, hasMore: false, total: 0 };
    container.innerHTML = '';

    // Reset search
    const searchInput = document.getElementById('session-detail-search-input');
    if (searchInput) searchInput.value = '';
    const countEl = document.getElementById('session-detail-search-count');
    if (countEl) countEl.textContent = '';

    await Sessions.loadMore();
    Sessions.setupScroll();

    if (typeof TerminalPanel !== 'undefined' && TerminalPanel.shouldAutoOpen() && !TerminalPanel.isOpen()) {
      TerminalPanel.open(slug, sessionId);
    }

    Sessions.applyConversationHiddenState();
    Sessions.applyToolDetailsState();
    if (!Sessions.isConversationHidden()) Sessions.startAutoRefresh();
  },

  startAutoRefresh() {
    Sessions.stopAutoRefresh();
    if (Sessions.isConversationHidden()) return;
    Sessions._refreshTimer = setInterval(() => Sessions.pollNewMessages(), Sessions.refreshIntervalMs());
    if (typeof setFooterStatus === 'function') {
      const sec = Math.round(Sessions.refreshIntervalMs() / 1000);
      setFooterStatus(`Live · refresh ${sec}s`, true);
    }
  },

  stopAutoRefresh() {
    if (Sessions._refreshTimer) { clearInterval(Sessions._refreshTimer); Sessions._refreshTimer = null; }
    if (typeof setFooterStatus === 'function') setFooterStatus('Idle', false);
  },

  async pollNewMessages() {
    const state = Sessions.detailState;
    if (!state.slug || !state.sessionId) return;
    if (state.loading) return;
    if (Sessions.isConversationHidden()) return;
    if (Sessions._detailSearchQuery) return; // don't disturb active filter
    const slugAtStart = state.slug;
    const sessionAtStart = state.sessionId;

    try {
      const data = await api(`/api/projects/${slugAtStart}/sessions/${sessionAtStart}?offset=0&limit=20`);
      if (state.slug !== slugAtStart || state.sessionId !== sessionAtStart) return;

      if (data.stats) Sessions.renderDetailMeta(data.stats);

      if (typeof data.total !== 'number' || data.total <= state.total) return;

      const added = data.total - state.total;
      const newMessages = data.messages.slice(0, added);
      const html = newMessages.map(m => Sessions.renderMessage(m)).join('');

      const container = document.getElementById('session-messages');
      if (!container) return;
      container.insertAdjacentHTML('afterbegin', html);

      state.total = data.total;
      state.offset += added;

      Sessions.updateMessageCount();
    } catch (_) { /* silent — transient network error */ }
  },

  scrollContainer() {
    return document.getElementById('session-messages-pane')
      || document.querySelector('#view-session-detail .view-body');
  },

  setupScroll() {
    const scroller = Sessions.scrollContainer();
    if (!scroller) return;
    if (Sessions._scrollHandler && Sessions._scrollTarget) {
      Sessions._scrollTarget.removeEventListener('scroll', Sessions._scrollHandler);
    }
    const topBtn = document.getElementById('scroll-to-top-btn');
    if (topBtn) topBtn.classList.remove('visible');
    Sessions._scrollHandler = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      if (topBtn) topBtn.classList.toggle('visible', scrollTop > 400);
      if (Sessions.detailState.loading || !Sessions.detailState.hasMore) return;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        Sessions.loadMore();
      }
    };
    Sessions._scrollTarget = scroller;
    scroller.addEventListener('scroll', Sessions._scrollHandler);
  },

  scrollToTop() {
    const scroller = Sessions.scrollContainer();
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
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

      if (data.stats) Sessions.renderDetailMeta(data.stats);

      const html = data.messages.map(m => Sessions.renderMessage(m)).join('');
      container.insertAdjacentHTML('beforeend', html);

      Sessions.updateMessageCount();

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

      // Re-apply active search to newly loaded messages
      if (Sessions._detailSearchQuery) {
        Sessions.applyDetailFilter(Sessions._detailSearchQuery);
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
    const hasText = msg.content.some(b => b.type === 'text' && b.text && b.text.trim());

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
      <div class="chat-msg ${msg.role}${hasText ? '' : ' chat-msg-tools-only'}">
        <div class="chat-role ${msg.role}">
          <span class="chat-role-label">${msg.role === 'user' ? 'You' : 'Claude'}</span>
          ${msg.model && msg.role === 'assistant' ? `<span class="chat-model">${escapeHtml(shortModel(msg.model))}</span>` : ''}
          <span class="chat-time">${time}</span>
        </div>
        ${bodyHtml}
      </div>
    `;
  },

  _detailSearchTimer: null,
  _detailSearchQuery: '',

  onDetailSearch(value) {
    clearTimeout(Sessions._detailSearchTimer);
    const q = value.trim();
    Sessions._detailSearchQuery = q;

    Sessions._detailSearchTimer = setTimeout(async () => {
      if (Sessions._detailSearchQuery !== q) return;

      // Load all remaining messages so search covers the whole session
      if (q && Sessions.detailState.hasMore) {
        await Sessions.loadAllMessages();
        if (Sessions._detailSearchQuery !== q) return;
      }

      Sessions.applyDetailFilter(q);
    }, 250);
  },

  async loadAllMessages() {
    while (Sessions.detailState.hasMore && !Sessions.detailState.loading) {
      await Sessions.loadMore();
    }
  },

  applyDetailFilter(query) {
    const container = document.getElementById('session-messages');
    const countEl = document.getElementById('session-detail-search-count');
    const messages = container.querySelectorAll('.chat-msg');
    const showTools = Sessions.showToolDetails();

    // Remove any existing highlights
    container.querySelectorAll('mark.search-highlight').forEach(m => {
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });

    if (!query) {
      messages.forEach(msg => msg.style.display = '');
      if (countEl) countEl.textContent = '';
      return;
    }

    const qLower = query.toLowerCase();
    let matchedMessages = 0;
    let totalMatches = 0;

    messages.forEach(msg => {
      // When tools are hidden, tool-only messages are invisible — skip them.
      if (!showTools && msg.classList.contains('chat-msg-tools-only')) {
        msg.style.display = '';
        return;
      }
      // When tools are hidden, search only the visible chat-text blocks.
      let text;
      if (showTools) {
        text = msg.textContent.toLowerCase();
      } else {
        text = Array.from(msg.querySelectorAll('.chat-text'))
          .map(n => n.textContent).join(' ').toLowerCase();
      }
      if (text.includes(qLower)) {
        msg.style.display = '';
        matchedMessages++;
        const scope = showTools ? msg : msg.querySelectorAll('.chat-text');
        if (showTools) {
          totalMatches += Sessions.highlightInNode(msg, query);
        } else {
          scope.forEach(n => { totalMatches += Sessions.highlightInNode(n, query); });
        }
      } else {
        msg.style.display = 'none';
      }
    });

    if (countEl) {
      countEl.textContent = matchedMessages
        ? `${totalMatches} matches in ${matchedMessages} messages`
        : 'No matches';
    }
  },

  highlightInNode(root, query) {
    const qLower = query.toLowerCase();
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentNode.tagName === 'SCRIPT' || n.parentNode.tagName === 'STYLE'
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      let idx = lower.indexOf(qLower);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        count++;
        last = idx + query.length;
        idx = lower.indexOf(qLower, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
    return count;
  },

  async checkPricing() {
    try {
      await api('/api/pricing/fetch', { method: 'POST' });
    } catch (_) {
      toast('Pricing check failed — using cached data', 'error');
    }
  },

  async newSessionOS(slug) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    try {
      await Sessions.checkPricing();
      await api(`/api/projects/${slug}/sessions/new`, { method: 'POST' });
      toast('New session opened');
    } catch (e) {
      toast('Failed to open terminal: ' + e.message, 'error');
    }
  },

  async newSessionBrowser(slug) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    try {
      await Sessions.checkPricing();
    } catch (_) { /* non-fatal */ }
    if (typeof TerminalModal === 'undefined') {
      toast('Terminal libraries not loaded', 'error');
      return;
    }
    TerminalModal.open(slug, '', 'New session');
  },

  async resumeOS(slug, sessionId) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    try {
      await Sessions.checkPricing();
      await api(`/api/projects/${slug}/sessions/${sessionId}/resume`, { method: 'POST' });
      if (typeof TerminalPanel !== 'undefined' && TerminalPanel.isOpen()) {
        TerminalPanel.setAutoOpen(false);
        TerminalPanel.close();
      }
      toast('Terminal opened with session');
    } catch (e) {
      toast('Failed to open terminal: ' + e.message, 'error');
    }
  },

  async resumeBrowser(slug, sessionId) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    try {
      await Sessions.checkPricing();
    } catch (_) { /* non-fatal */ }
    if (typeof TerminalPanel !== 'undefined') TerminalPanel.setAutoOpen(true);
    const cached = Sessions.cache[slug] || [];
    const info = cached.find(s => s.sessionId === sessionId);
    App.navigate('session-detail', { slug, sessionId, sessionInfo: info });
  },

  resumeFromMenu() {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    const { slug, sessionId } = Sessions.detailState;
    if (!slug || !sessionId) return;
    Sessions.resumeOS(slug, sessionId);
  },

  toggleActionMenu(btn) {
    const panel = btn.nextElementSibling;
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) panel.classList.add('open');
  },

  renameAction(btn) {
    Sessions.openRenameModal(btn.dataset.slug, btn.dataset.session, btn.dataset.title || '');
  },

  copyIdAction(sessionId) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    if (!sessionId) { toast('No session ID', 'error'); return; }
    copyToClipboard(sessionId, 'Session ID copied');
  },

  copyIdDetail() {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    const id = Sessions.detailState.sessionId;
    if (!id) { toast('No session ID', 'error'); return; }
    copyToClipboard(id, 'Session ID copied');
  },

  renameDetail() {
    const { slug, sessionId } = Sessions.detailState;
    if (!slug || !sessionId) return;
    const current = document.getElementById('session-detail-title')?.textContent || '';
    Sessions.openRenameModal(slug, sessionId, current === 'Session' ? '' : current);
  },

  openRenameModal(slug, sessionId, currentTitle) {
    document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
    openModal({
      title: 'Rename session',
      body: formGroup('Title', `<input type="text" id="rename-session-title" maxlength="500" value="${escapeHtml(currentTitle)}" style="width:100%">`),
      buttons: [{
        label: 'Save',
        primary: true,
        onClick: async () => {
          const title = document.getElementById('rename-session-title').value.trim();
          if (!title) { toast('Title is required', 'error'); return false; }
          try {
            await api(`/api/projects/${slug}/sessions/${sessionId}/rename`, {
              method: 'POST',
              body: { title }
            });
            toast('Session renamed');
            Sessions.applyRename(slug, sessionId, title);
          } catch (e) {
            toast('Rename failed: ' + e.message, 'error');
            return false;
          }
        }
      }]
    });
    setTimeout(() => document.getElementById('rename-session-title')?.focus(), 0);
  },

  applyRename(slug, sessionId, title) {
    const cached = Sessions.cache[slug];
    if (cached) {
      const s = cached.find(x => x.sessionId === sessionId);
      if (s) s.summary = title;
    }
    if (Sessions.detailState.slug === slug && Sessions.detailState.sessionId === sessionId) {
      const el = document.getElementById('session-detail-title');
      if (el) { el.textContent = title; el.title = title; }
    }
    document.querySelectorAll(`.session-card[data-session-id="${sessionId}"] .session-summary`).forEach(el => {
      el.textContent = title;
    });
    document.querySelectorAll(`.session-card[data-session-id="${sessionId}"] .action-menu-item[data-session="${sessionId}"]`).forEach(btn => {
      btn.dataset.title = title;
    });
  },

};

document.addEventListener('click', () => {
  document.querySelectorAll('.action-menu-panel.open').forEach(p => p.classList.remove('open'));
});
