Object.assign(Sessions, {
  _activityItems: [],
  _activityFilter: null,
  _activityLoaded: false,

  async loadActivity() {
    const { slug, sessionId } = Sessions.detailState;
    if (!slug || !sessionId) return;

    const panel = document.getElementById('session-activity');
    if (!panel) return;
    panel.innerHTML = '<div class="loading"><div class="spinner"></div> Loading activity...</div>';
    Sessions._activityLoaded = false;

    try {
      const data = await api(`/api/projects/${slug}/sessions/${sessionId}/activity`);
      Sessions._activityItems = data.items || [];
      Sessions._activityFilter = null;
      Sessions._activityLoaded = true;
      Sessions._renderActivity(data);
    } catch (_) {
      panel.innerHTML = '<div class="empty-state"><p>Could not load activity</p></div>';
    }
  },

  async refreshActivity() {
    const panel = document.getElementById('session-activity');
    if (!panel || panel.style.display === 'none') return;
    if (!Sessions._activityLoaded) return;
    const { slug, sessionId } = Sessions.detailState;
    if (!slug || !sessionId) return;
    try {
      const data = await api(`/api/projects/${slug}/sessions/${sessionId}/activity`);
      Sessions._activityItems = data.items || [];
      const prevFilter = Sessions._activityFilter;
      Sessions._renderActivity(data);
      if (prevFilter) Sessions._applyActivityFilter(prevFilter);
    } catch (_) {}
  },

  _renderActivity(data) {
    const panel = document.getElementById('session-activity');
    if (!panel) return;
    const items = data.items || [];
    const stats = data.stats || {};

    if (items.length === 0) {
      panel.innerHTML = '<div class="empty-state"><p>No tool calls recorded in this session</p></div>';
      return;
    }

    const cats = [
      { key: '', label: 'All', count: stats.total || 0 },
      { key: 'agent', label: 'Agents', count: stats.byCategory?.agent || 0 },
      { key: 'web', label: 'Web', count: stats.byCategory?.web || 0 },
      { key: 'shell', label: 'Shell', count: stats.byCategory?.shell || 0 },
      { key: 'file', label: 'Files', count: stats.byCategory?.file || 0 },
      { key: 'other', label: 'Other', count: stats.byCategory?.other || 0 }
    ].filter(c => c.key === '' || c.count > 0);

    const filterBar = cats.map(c =>
      `<button class="activity-filter-btn${(!Sessions._activityFilter && !c.key) || Sessions._activityFilter === c.key ? ' active' : ''}"
        data-cat="${escapeHtml(c.key)}"
        onclick="Sessions._applyActivityFilter(this.dataset.cat)">
        ${escapeHtml(c.label)} <span class="activity-filter-count">${c.count}</span>
      </button>`
    ).join('');

    const listHtml = items.map((item, i) => Sessions._renderActivityItem(item, i)).join('');

    panel.innerHTML = `
      <div class="activity-filter-bar">${filterBar}</div>
      <div class="activity-list" id="activity-list">${listHtml}</div>
    `;
  },

  _applyActivityFilter(cat) {
    Sessions._activityFilter = cat || null;
    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === (cat || ''));
    });
    const list = document.getElementById('activity-list');
    if (!list) return;
    const filtered = cat
      ? Sessions._activityItems.filter(item => item.category === cat)
      : Sessions._activityItems;
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No items in this category</p></div>';
      return;
    }
    list.innerHTML = filtered.map((item, i) => Sessions._renderActivityItem(item, i)).join('');
  },

  _renderActivityItem(item, i) {
    const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '';
    const label = item.label || '';
    let shortLabel = label;

    if (item.category === 'file') {
      shortLabel = label.split(/[/\\]/).pop() || label;
    } else if (item.category === 'web' && item.tool === 'WebFetch') {
      try {
        const u = new URL(label);
        const p = u.pathname.length > 40 ? u.pathname.slice(0, 40) + '…' : u.pathname;
        shortLabel = u.hostname + p;
      } catch (_) {
        shortLabel = label.slice(0, 80);
      }
    } else if (item.category === 'shell') {
      shortLabel = label.slice(0, 90) + (label.length > 90 ? '…' : '');
    } else {
      shortLabel = label.slice(0, 90) + (label.length > 90 ? '…' : '');
    }

    const needsDetail = label.length > shortLabel.length || item.category === 'file';
    const detailContent = item.category === 'file'
      ? `<div class="activity-detail-path">${escapeHtml(label)}</div>`
      : `<pre class="tool-code">${escapeHtml(label)}</pre>`;
    const itemId = 'act-' + i;

    return `
      <div class="activity-item${needsDetail ? ' activity-item-expandable' : ''}" ${needsDetail ? `onclick="document.getElementById('${itemId}').classList.toggle('open')"` : ''}>
        <div class="activity-item-main">
          <span class="activity-tool-badge activity-cat-${escapeHtml(item.category)}">${escapeHtml(item.tool)}</span>
          <span class="activity-item-label" title="${escapeHtml(label)}">${escapeHtml(shortLabel)}</span>
          <span class="activity-item-time">${time}</span>
        </div>
        ${needsDetail ? `<div class="activity-item-detail" id="${itemId}">${detailContent}</div>` : ''}
      </div>`;
  }
});
