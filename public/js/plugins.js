// --- Plugins (read-only) ---

const Plugins = {
  async load() {
    showLoading('plugins-content');
    try {
      const data = await api('/api/plugins');
      Plugins.render(data);
    } catch (e) { toast('Could not load plugins: ' + e.message, 'error'); }
  },

  render(data) {
    const container = document.getElementById('plugins-content');
    let html = `<div class="info-note">
      Plugins extend Claude Code with additional tools, skills, and MCP servers.
      Installed from marketplaces (e.g. <code>anthropics/claude-plugins-official</code> on GitHub).
      Blocked plugins are prevented from loading. Manage plugins via <code>/plugins</code> in Claude Code.
      This view is <strong>read-only</strong>.
    </div>`;
    html += '<h3 style="margin:16px 0 12px">Marketplaces</h3>';

    const mktNames = Object.keys(data.marketplaces || {});
    if (mktNames.length === 0) {
      html += '<div class="empty-state"><p>No marketplaces installed</p></div>';
    } else {
      html += '<div class="card-grid">' + mktNames.map(name => {
        const m = data.marketplaces[name];
        return `<div class="card"><strong style="color:var(--accent)">${escapeHtml(name)}</strong>
          ${m.source?.repo ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(m.source.repo)}</div>` : ''}
          ${m.lastUpdated ? `<div style="font-size:11px;color:var(--text-muted)">Updated: ${new Date(m.lastUpdated).toLocaleString()}</div>` : ''}
        </div>`;
      }).join('') + '</div>';
    }

    html += '<h3 style="margin:20px 0 12px">Blocklist</h3>';
    if (data.blocklist.length === 0) {
      html += '<p style="color:var(--text-muted)">No blocked plugins</p>';
    } else {
      html += data.blocklist.map(p => `
        <div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between">
            <div>
              <strong>${escapeHtml(p.plugin)}</strong>
              <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(p.reason || '')} — ${escapeHtml(p.text || '')}</div>
            </div>
            <span class="prop-type" style="color:var(--danger)">blocked</span>
          </div>
        </div>
      `).join('');
    }

    container.innerHTML = html;
  }
};
