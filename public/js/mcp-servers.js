// --- MCP Servers ---

const McpServers = {
  data: { servers: {} },
  cloudIntegrations: [],

  async load() {
    showLoading('mcp-servers-list');
    try {
      const [mcp, cloud] = await Promise.all([
        api('/api/mcp/global'),
        api('/api/mcp/cloud')
      ]);
      McpServers.data = mcp;
      McpServers.cloudIntegrations = cloud;
      McpServers.render();
    } catch (e) {
      toast('Could not load MCP config: ' + e.message, 'error');
    }
  },

  render() {
    const container = document.getElementById('mcp-servers-list');
    const servers = McpServers.data.servers || {};
    const names = Object.keys(servers);
    let html = '';

    // Info note
    html += `<div class="info-note">
      <strong>Local MCP Servers</strong> are tools you configure yourself (database connectors, custom APIs, local services).
      They run on your machine and are defined in <code>~/.claude/.mcp.json</code>.
      Supports <code>stdio</code>, <code>sse</code>, and <code>http</code> transport types.
    </div>`;

    // Cloud integrations
    if (McpServers.cloudIntegrations.length > 0) {
      html += '<h3 style="margin:16px 0 8px">Cloud-Managed Integrations</h3>';
      html += `<div class="info-note" style="margin-bottom:8px">
        These are managed by Anthropic via <code>claude.ai</code>. They use OAuth and cannot be edited locally.
        To add or remove cloud integrations, use <code>/mcp</code> in Claude Code or visit claude.ai settings.
      </div>`;
      html += McpServers.cloudIntegrations.map(c => `
        <div class="card" style="margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="color:var(--accent);text-transform:capitalize">${escapeHtml(c.provider)}</strong>
            <span class="prop-type">cloud</span>
            <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${escapeHtml(c.id)}</span>
          </div>
        </div>
      `).join('');
    }

    // Local servers
    html += '<h3 style="margin:20px 0 8px">Local Servers</h3>';

    if (names.length === 0) {
      html += '<p style="color:var(--text-muted);margin-bottom:12px">No local MCP servers configured</p>';
      container.innerHTML = html;
      return;
    }

    container.innerHTML = names.map(name => {
      const s = servers[name];
      return `
        <div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <strong style="font-family:var(--font-mono);color:var(--accent)">${escapeHtml(name)}</strong>
                <span class="prop-type">${escapeHtml(s.type || 'stdio')}</span>
                ${s.disabled ? '<span class="prop-type" style="color:var(--danger)">disabled</span>' : ''}
              </div>
              ${s.command ? `<div class="form-group"><label>Command</label><input type="text" value="${escapeHtml(s.command)}" onchange="McpServers.update('${escapeHtml(name)}','command',this.value)"></div>` : ''}
              ${s.url ? `<div class="form-group"><label>URL</label><input type="text" value="${escapeHtml(s.url)}" onchange="McpServers.update('${escapeHtml(name)}','url',this.value)"></div>` : ''}
              ${s.args ? `<div class="form-group"><label>Args</label><input type="text" value="${escapeHtml(JSON.stringify(s.args))}" onchange="McpServers.updateArgs('${escapeHtml(name)}',this.value)"></div>` : ''}
              ${s.env ? `<div class="form-group"><label>Env</label><textarea rows="2" style="font-family:var(--font-mono);font-size:12px" onchange="McpServers.updateEnv('${escapeHtml(name)}',this.value)">${escapeHtml(JSON.stringify(s.env, null, 2))}</textarea></div>` : ''}
            </div>
            <div class="btn-group" style="margin-left:12px">
              <button class="btn btn-sm" onclick="McpServers.toggle('${escapeHtml(name)}')">${s.disabled ? 'Enable' : 'Disable'}</button>
              <button class="btn btn-sm btn-danger" onclick="McpServers.remove('${escapeHtml(name)}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  update(name, field, value) {
    McpServers.data.servers[name][field] = value;
  },

  updateArgs(name, value) {
    try { McpServers.data.servers[name].args = JSON.parse(value); } catch (_) { toast('Invalid JSON array', 'error'); }
  },

  updateEnv(name, value) {
    try { McpServers.data.servers[name].env = JSON.parse(value); } catch (_) { toast('Invalid JSON', 'error'); }
  },

  toggle(name) {
    const s = McpServers.data.servers[name];
    s.disabled = !s.disabled;
    McpServers.render();
  },

  remove(name) {
    delete McpServers.data.servers[name];
    McpServers.render();
  },

  addServer() {
    openModal({
      title: 'Add MCP Server',
      body: formGroup('Name', '<input type="text" id="mcp-new-name" placeholder="my-server">')
        + formGroup('Type', selectHtml('mcp-new-type', MCP_TYPES, 'stdio'))
        + formGroup('Command / URL', '<input type="text" id="mcp-new-cmd" placeholder="/path/to/server or http://...">'),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const name = document.getElementById('mcp-new-name').value.trim();
          const type = document.getElementById('mcp-new-type').value;
          const cmd = document.getElementById('mcp-new-cmd').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          if (!McpServers.data.servers) McpServers.data.servers = {};
          const server = { type };
          if (type === 'stdio') { server.command = cmd; server.args = []; }
          else { server.url = cmd; }
          McpServers.data.servers[name] = server;
          McpServers.render();
        }
      }]
    });
  },

  async save() {
    try {
      await api('/api/mcp/global', { method: 'PUT', body: McpServers.data });
      toast('MCP servers saved');
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }
};
