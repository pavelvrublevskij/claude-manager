// --- Sessions ---

const Sessions = {
  cache: {},

  async load(slug) {
    const container = document.getElementById('sessions-list');
    showLoading(container, 'Loading sessions...');

    try {
      const sessions = await api(`/api/projects/${slug}/sessions`);
      Sessions.cache[slug] = sessions;
      if (sessions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No sessions found</p></div>';
        return;
      }
      container.innerHTML = sessions.map((s, i) => {
        const created = s.created ? new Date(s.created).toLocaleString() : '—';
        const modified = s.modified ? new Date(s.modified).toLocaleString() : '—';
        return `
          <div class="session-card" style="cursor:pointer" onclick="Sessions.open('${slug}', '${s.sessionId}', ${i})">
            <div class="session-summary">${escapeHtml(s.summary || s.firstPrompt || 'Untitled session')}</div>
            ${s.firstPrompt && s.summary ? `<div class="session-prompt">${escapeHtml(s.firstPrompt)}</div>` : ''}
            <div class="session-meta">
              <div class="meta-item">Created <span class="meta-value">${created}</span></div>
              <div class="meta-item">Modified <span class="meta-value">${modified}</span></div>
              <div class="meta-item">Messages <span class="meta-value">${s.messageCount}</span></div>
              ${s.gitBranch ? `<span class="session-branch">${escapeHtml(s.gitBranch)}</span>` : ''}
              ${s.lastGitBranch && s.lastGitBranch !== s.gitBranch ? `<span class="session-branch" style="opacity:0.7">&#8594; ${escapeHtml(s.lastGitBranch)}</span>` : ''}
              ${s.isSidechain ? '<span class="session-sidechain">sidechain</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Could not load sessions</p></div>`;
    }
  },

  open(slug, sessionId, index) {
    const sessions = Sessions.cache[slug] || [];
    App.navigate('session-detail', { slug, sessionId, sessionInfo: sessions[index] });
  },

  detailState: { slug: null, sessionId: null, offset: 0, loading: false, hasMore: false, total: 0 },

  async loadDetail(slug, sessionId, info) {
    const title = document.getElementById('session-detail-title');
    const meta = document.getElementById('session-detail-meta');
    const container = document.getElementById('session-messages');

    title.textContent = info?.summary || info?.firstPrompt?.slice(0, 80) || 'Session';
    const created = info?.created ? new Date(info.created).toLocaleString() : '';
    const branch = info?.gitBranch || '';
    meta.innerHTML = [created, branch ? `<span class="session-branch">${escapeHtml(branch)}</span>` : ''].filter(Boolean).join(' &middot; ');

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
          <span class="chat-time">${time}</span>
        </div>
        ${bodyHtml}
      </div>
    `;
  }
};
