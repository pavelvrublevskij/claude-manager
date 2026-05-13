const ProjectMcp = {
  projectScope: { servers: {}, path: '' },
  localScope: { servers: {}, path: '', projectKey: '' },
  slug: null,

  async load(slug) {
    ProjectMcp.slug = slug;
    const container = document.getElementById('proj-mcp-content');
    showLoading(container);
    try {
      const res = await api(`/api/mcp/project/${slug}`);
      ProjectMcp.projectScope = res.projectScope || { servers: {}, path: '' };
      ProjectMcp.localScope = res.localScope || { servers: {}, path: '', projectKey: '' };
      ProjectMcp.render();
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  },

  render() {
    const container = document.getElementById('proj-mcp-content');
    container.innerHTML =
      ProjectMcp.sectionHtml(
        'project', 'Project Scope',
        ProjectMcp.projectScope.servers,
        ProjectMcp.projectScope.path,
        'Committed to git via <code>.mcp.json</code> at the project root. Equivalent to <code>claude mcp add --scope project</code>.'
      )
      + ProjectMcp.sectionHtml(
        'local', 'Local Scope',
        ProjectMcp.localScope.servers,
        ProjectMcp.localScope.path + ' → projects[' + ProjectMcp.localScope.projectKey + ']',
        'Only for you, only in this project. Stored in <code>~/.claude.json</code>. Equivalent to <code>claude mcp add --scope local</code> (the default).'
      );
  },

  sectionHtml(scope, title, servers, pathLabel, description) {
    const names = Object.keys(servers || {});
    const cards = names.length === 0
      ? '<p style="color:var(--text-muted);margin:8px 0 12px">No servers</p>'
      : names.map(name => {
          const s = servers[name];
          return `<div class="card" style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="color:var(--accent);font-family:var(--font-mono)">${escapeHtml(name)}</strong>
                <span class="prop-type">${escapeHtml(s.type || 'stdio')}</span>
                ${s.disabled ? '<span class="prop-type" style="color:var(--danger)">disabled</span>' : ''}
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(s.command || s.url || '')}</div>
              </div>
              <button class="prop-action-btn danger" onclick="ProjectMcp.remove('${scope}','${escapeHtml(name)}')">&#10005;</button>
            </div>
          </div>`;
        }).join('');

    return `<div style="margin-bottom:24px">
      <h3 style="margin:0 0 4px">${escapeHtml(title)}</h3>
      <div class="info-note" style="margin-bottom:8px">${description}</div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-family:var(--font-mono)">${escapeHtml(pathLabel)}</p>
      ${cards}
      <div style="margin-top:8px">
        <button class="btn" onclick="ProjectMcp.add('${scope}')">+ Add Server</button>
        <button class="btn btn-primary" onclick="ProjectMcp.save('${scope}')">Save</button>
      </div>
    </div>`;
  },

  scopeRef(scope) {
    return scope === 'project' ? ProjectMcp.projectScope : ProjectMcp.localScope;
  },

  add(scope) {
    openModal({
      title: 'Add ' + (scope === 'project' ? 'Project-Scope' : 'Local-Scope') + ' MCP Server',
      body: formGroup('Name', '<input type="text" id="mcp-new-name" placeholder="my-server">')
        + formGroup('Type', selectHtml('mcp-new-type', MCP_TYPES, 'stdio'))
        + formGroup('Command / URL', '<input type="text" id="mcp-new-cmd" placeholder="/path/to/server or http://...">'),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const name = document.getElementById('mcp-new-name').value.trim();
          const type = document.getElementById('mcp-new-type').value;
          const cmd = document.getElementById('mcp-new-cmd').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          const ref = ProjectMcp.scopeRef(scope);
          if (!ref.servers) ref.servers = {};
          const server = { type };
          if (type === 'stdio') { server.command = cmd; server.args = []; }
          else { server.url = cmd; }
          ref.servers[name] = server;
          ProjectMcp.render();
        }
      }]
    });
  },

  remove(scope, name) {
    const ref = ProjectMcp.scopeRef(scope);
    delete ref.servers[name];
    ProjectMcp.render();
  },

  async save(scope) {
    const ref = ProjectMcp.scopeRef(scope);
    try {
      await api(`/api/mcp/project/${ProjectMcp.slug}/${scope}`, { method: 'PUT', body: { servers: ref.servers } });
      toast(`${scope === 'project' ? 'Project-scope' : 'Local-scope'} MCP saved`);
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }
};
