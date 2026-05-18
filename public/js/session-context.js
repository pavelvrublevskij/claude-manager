Object.assign(Sessions, {
  async pollContext(slug, sessionId) {
    const el = document.getElementById('session-context');
    if (!el) return;

    const info = Sessions._detailInfo;
    const from = info && info.created ? new Date(info.created).toISOString() : '';
    const to = info && info.modified ? new Date(info.modified).toISOString() : '';
    const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';

    try {
      const data = await api(`/api/file-history/${encodeURIComponent(sessionId)}/context${qs}`);
      if (Sessions.detailState.sessionId !== sessionId) return;

      const hasFiles = data.files && data.files.length > 0;
      const hasPlans = data.plans && data.plans.length > 0;
      if (!hasFiles && !hasPlans) return;

      const ctx = Sessions._ctx;
      const sameFiles = ctx && ctx.files.length === data.files.length;
      const samePlans = ctx && ctx.plans.length === (data.plans ? data.plans.length : 0);
      if (sameFiles && samePlans) return;

      const savedSort = ctx && ctx.sort || 'default';
      Sessions.renderContext(el, sessionId, data);
      if (savedSort !== 'default') Sessions.sortCtxFiles(savedSort);
    } catch (_) {}
  },

  annotateDetailPlan(stats) {
    if (stats && stats.hasPlan) {
      Sessions._detailHasPlan = true;
      Sessions.renderDetailMeta(null);
    }
  },

  async annotatePlans(sessions) {
    if (!sessions.length) { Sessions._planSessionIds = new Set(); return; }
    const slug = Sessions._searchSlug;
    if (!slug) { Sessions._planSessionIds = new Set(); return; }
    try {
      const ids = await api(`/api/projects/${encodeURIComponent(slug)}/sessions/with-plans`);
      Sessions._planSessionIds = new Set(ids);
      Sessions._rerenderPlans();
    } catch (_) {
      Sessions._planSessionIds = new Set();
    }
  },

  async loadContext(sessionId, info) {
    const el = document.getElementById('session-context');
    if (!el) return;

    const from = info && info.created ? new Date(info.created).toISOString() : '';
    const to = info && info.modified ? new Date(info.modified).toISOString() : '';
    const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';

    try {
      const data = await api(`/api/file-history/${encodeURIComponent(sessionId)}/context${qs}`);
      Sessions.renderContext(el, sessionId, data);
    } catch (_) {
      Sessions.switchTab('conversation');
    }
  },

  renderContext(el, sessionId, data) {
    const hasFiles = data.files && data.files.length > 0;
    const hasPlans = data.plans && data.plans.length > 0;
    if (!hasFiles && !hasPlans) { Sessions.switchTab('conversation'); return; }

    Sessions._ctx = { sessionId, projSlug: data.projSlug || '', files: data.files || [], plans: data.plans || [], sort: 'default' };

    let html = '';

    if (hasFiles) {
      const sortHtml = `<div class="ctx-sort-bar">
        <span class="ctx-sort-label">Sort:</span>
        <button class="ctx-sort-btn active" onclick="Sessions.sortCtxFiles('default')">Default</button>
        <button class="ctx-sort-btn" onclick="Sessions.sortCtxFiles('asc')">A→Z</button>
        <button class="ctx-sort-btn" onclick="Sessions.sortCtxFiles('desc')">Z→A</button>
      </div>`;

      html += `<div class="ctx-section" id="ctx-files-section">
        <button class="ctx-toggle" onclick="Sessions.toggleCtx('ctx-files-section')">
          <span class="ctx-arrow">&#9660;</span> Files edited (${data.files.length})
        </button>
        <div class="ctx-body">
          ${sortHtml}
          <div id="ctx-file-list">${Sessions._renderCtxFileList()}</div>
        </div>
      </div>`;
    }

    if (hasPlans) {
      const planRows = data.plans.map(p =>
        `<div class="ctx-plan-row" onclick="Sessions.showPlan('${p.name}')">
          <span class="ctx-plan-name">${escapeHtml(p.name)}</span>
          <span class="ctx-plan-time">${timeAgo(p.mtime)}</span>
        </div>`
      ).join('');

      html += `<div class="ctx-section" id="ctx-plans-section">
        <button class="ctx-toggle" onclick="Sessions.toggleCtx('ctx-plans-section')">
          <span class="ctx-arrow">&#9660;</span> Plans (${data.plans.length})
        </button>
        <div class="ctx-body">${planRows}</div>
      </div>`;
    }

    el.innerHTML = html;
  },

  _renderCtxFileList() {
    const { sessionId, files, sort } = Sessions._ctx;
    let visible = files.slice();
    if (sort === 'asc') visible.sort((a, b) => a.path.split(/[\\/]/).pop().localeCompare(b.path.split(/[\\/]/).pop()));
    else if (sort === 'desc') visible.sort((a, b) => b.path.split(/[\\/]/).pop().localeCompare(a.path.split(/[\\/]/).pop()));
    if (!visible.length) return '<div class="ctx-empty">No files changed</div>';
    return visible.map(f => {
      const name = f.path.replace(/\\/g, '/').split('/').pop();
      const status = f.isNew ? 'new' : (f.isDeleted ? 'deleted' : 'edited');
      const badge = `<span class="ctx-file-badge ctx-file-badge-${status}">${status}</span>`;
      return `<div class="ctx-file-item ctx-file-${status}"
        data-session="${escapeHtml(sessionId)}"
        data-hash="${escapeHtml(f.hash || '')}"
        data-from="${f.versions[0] || ''}"
        data-path="${escapeHtml(f.path)}"
        data-is-new="${f.isNew ? '1' : ''}"
        data-is-deleted="${f.isDeleted ? '1' : ''}"
        title="${escapeHtml(f.path)}"
        onclick="Sessions._openCtxDiff(this)">${badge}<span class="ctx-file-name">${escapeHtml(name)}</span></div>`;
    }).join('');
  },

  sortCtxFiles(order) {
    Sessions._ctx.sort = order;
    document.querySelectorAll('.ctx-sort-btn').forEach(btn => {
      const labels = { default: 'Default', asc: 'A→Z', desc: 'Z→A' };
      btn.classList.toggle('active', btn.textContent.trim() === labels[order]);
    });
    const list = document.getElementById('ctx-file-list');
    if (list) list.innerHTML = Sessions._renderCtxFileList();
  },

  _openCtxDiff(el) {
    const { session, hash, from, path, isNew, isDeleted } = el.dataset;
    FileHistory.showDiffCurrent(session, hash, parseInt(from, 10), Sessions._ctx.projSlug, path, {
      isNew: isNew === '1',
      isDeleted: isDeleted === '1'
    });
  },

  toggleCtx(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const body = section.querySelector('.ctx-body');
    const arrow = section.querySelector('.ctx-arrow');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    arrow.innerHTML = open ? '&#9654;' : '&#9660;';
  },

  async showPlan(name) {
    const overlay = openModal({
      title: name,
      width: 800,
      body: '<div id="plan-modal-body"><div class="loading"><div class="spinner"></div>Loading…</div></div>',
      buttons: []
    });
    try {
      const plan = await api(`/api/plans/${encodeURIComponent(name)}`);
      overlay.querySelector('#plan-modal-body').innerHTML =
        `<div class="markdown-body">${renderMarkdown(plan.content)}</div>`;
    } catch (e) {
      overlay.querySelector('#plan-modal-body').innerHTML =
        `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }
});
