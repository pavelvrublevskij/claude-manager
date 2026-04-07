// --- Project Tabs ---

const ProjectTabs = {
  switch(tab, btn) {
    document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
    ProjectTabs.loadTab(tab);
  },
  loadTab(tab) {
    if (!App.currentProject) return;
    const loaders = {
      'memory': () => Memory.load(App.currentProject),
      'sessions': () => Sessions.load(App.currentProject),
      'proj-settings': () => ProjectSettings.load(App.currentProject),
      'proj-mcp': () => ProjectMcp.load(App.currentProject),
      'proj-agents': () => ProjectAgents.load(App.currentProject),
      'proj-skills': () => ProjectSkills.load(App.currentProject),
      'proj-output-styles': () => ProjectOutputStyles.load(App.currentProject),
      'claude-md': () => ClaudeMd.loadProject(App.currentProject)
    };
    if (loaders[tab]) loaders[tab]();
  },
  refresh() {
    const activeTab = document.querySelector('.project-tab.active');
    if (activeTab) {
      const tab = activeTab.id.replace('tab-', '');
      ProjectTabs.loadTab(tab);
    }
    toast('Refreshed');
  }
};

// --- Project Settings Tab ---

const ProjectSettings = {
  async load(slug) {
    const container = document.getElementById('proj-settings-content');
    showLoading(container);
    try {
      const data = await api(`/api/project-settings/${slug}`);
      container.innerHTML = `
        <h3 style="margin-bottom:8px">Local Settings <span style="font-size:12px;color:var(--text-muted)">(gitignored)</span></h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${escapeHtml(data.localPath)}</p>
        <textarea id="proj-local-settings" class="json-editor" rows="12">${escapeHtml(JSON.stringify(data.local, null, 2))}</textarea>
        <div class="btn-group" style="margin:12px 0 24px">
          <button class="btn btn-primary" onclick="ProjectSettings.saveLocal('${slug}')">Save Local</button>
        </div>
        <h3 style="margin-bottom:8px">Shared Settings <span style="font-size:12px;color:var(--text-muted)">(committed to git)</span></h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${escapeHtml(data.sharedPath)}</p>
        <textarea id="proj-shared-settings" class="json-editor" rows="12">${escapeHtml(JSON.stringify(data.shared, null, 2))}</textarea>
        <div class="btn-group" style="margin-top:12px">
          <button class="btn btn-primary" onclick="ProjectSettings.saveShared('${slug}')">Save Shared</button>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Could not load: ${escapeHtml(e.message)}</p></div>`;
    }
  },

  async saveLocal(slug) {
    const content = document.getElementById('proj-local-settings').value;
    try {
      const data = JSON.parse(content);
      await api(`/api/project-settings/${slug}/local`, { method: 'PUT', body: data });
      toast('Local settings saved');
    } catch (e) { toast(e.message, 'error'); }
  },

  async saveShared(slug) {
    const content = document.getElementById('proj-shared-settings').value;
    try {
      const data = JSON.parse(content);
      await api(`/api/project-settings/${slug}/shared`, { method: 'PUT', body: data });
      toast('Shared settings saved');
    } catch (e) { toast(e.message, 'error'); }
  }
};

// --- Project MCP Tab ---

const ProjectMcp = {
  data: {},
  slug: null,

  async load(slug) {
    ProjectMcp.slug = slug;
    const container = document.getElementById('proj-mcp-content');
    showLoading(container);
    try {
      const res = await api(`/api/mcp/project/${slug}`);
      ProjectMcp.data = res.data;
      const servers = res.data.servers || {};
      const names = Object.keys(servers);

      if (names.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No project-level MCP servers</p></div><div style="text-align:center;margin-top:12px"><button class="btn" onclick="ProjectMcp.add()">+ Add Server</button></div>';
        return;
      }

      container.innerHTML = names.map(name => {
        const s = servers[name];
        return `<div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="color:var(--accent);font-family:var(--font-mono)">${escapeHtml(name)}</strong>
              <span class="prop-type">${escapeHtml(s.type || 'stdio')}</span>
              ${s.disabled ? '<span class="prop-type" style="color:var(--danger)">disabled</span>' : ''}
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(s.command || s.url || '')}</div>
            </div>
            <button class="prop-action-btn danger" onclick="ProjectMcp.remove('${escapeHtml(name)}')">&#10005;</button>
          </div>
        </div>`;
      }).join('') + '<div style="margin-top:12px"><button class="btn" onclick="ProjectMcp.add()">+ Add Server</button> <button class="btn btn-primary" onclick="ProjectMcp.save()">Save</button></div>';
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  },

  add() {
    openModal({
      title: 'Add Project MCP Server',
      body: formGroup('Name', '<input type="text" id="mcp-new-name" placeholder="my-server">')
        + formGroup('Type', selectHtml('mcp-new-type', MCP_TYPES, 'stdio'))
        + formGroup('Command / URL', '<input type="text" id="mcp-new-cmd" placeholder="/path/to/server or http://...">'),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const name = document.getElementById('mcp-new-name').value.trim();
          const type = document.getElementById('mcp-new-type').value;
          const cmd = document.getElementById('mcp-new-cmd').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          if (!ProjectMcp.data.servers) ProjectMcp.data.servers = {};
          const server = { type };
          if (type === 'stdio') { server.command = cmd; server.args = []; }
          else { server.url = cmd; }
          ProjectMcp.data.servers[name] = server;
          ProjectMcp.load(ProjectMcp.slug);
        }
      }]
    });
  },

  remove(name) {
    delete ProjectMcp.data.servers[name];
    ProjectMcp.load(ProjectMcp.slug);
  },

  async save() {
    try {
      await api(`/api/mcp/project/${ProjectMcp.slug}`, { method: 'PUT', body: ProjectMcp.data });
      toast('Project MCP saved');
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }
};

// --- Project Agents Tab ---

const ProjectAgents = {
  slug: null,

  async load(slug) {
    ProjectAgents.slug = slug;
    const container = document.getElementById('proj-agents-content');
    showLoading(container);
    try {
      const agents = await api(`/api/agents/project/${slug}`);
      if (agents.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No custom agents</p><p style="color:var(--text-secondary);margin-top:8px">Custom agents are subagent definitions in .claude/agents/</p></div><div style="text-align:center;margin-top:12px"><button class="btn" onclick="ProjectAgents.showCreate()">+ New Agent</button></div>';
        return;
      }
      container.innerHTML = '<div class="card-grid">' + agents.map(a => `
        <div class="card" style="cursor:pointer" onclick="ProjectAgents.edit('${escapeHtml(a.filename)}')">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div style="font-weight:600;margin-bottom:4px;color:var(--accent)">${escapeHtml(a.name)}</div>
              <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(a.description)}</div>
            </div>
            <button class="prop-action-btn danger" onclick="event.stopPropagation(); ProjectAgents.remove('${escapeHtml(a.filename)}')">&#10005;</button>
          </div>
        </div>
      `).join('') + '</div><div style="margin-top:12px"><button class="btn" onclick="ProjectAgents.showCreate()">+ New Agent</button></div>';
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  },

  async edit(filename) {
    try {
      const agent = await api(`/api/agents/project/${ProjectAgents.slug}/${filename}`);
      openModal({
        title: 'Edit Agent: ' + (agent.frontmatter.name || filename),
        width: 700,
        body: formRow(
            formGroup('Name', `<input type="text" id="agent-edit-name" value="${escapeHtml(agent.frontmatter.name || '')}">`),
            formGroup('Description', `<input type="text" id="agent-edit-desc" value="${escapeHtml(agent.frontmatter.description || '')}">`)
          )
          + formRow(
            formGroup('Tools', `<input type="text" id="agent-edit-tools" value="${escapeHtml(agent.frontmatter.tools || '')}" placeholder="Read, Grep, Bash(*)">`),
            formGroup('Model', `<input type="text" id="agent-edit-model" value="${escapeHtml(agent.frontmatter.model || '')}" placeholder="default">`)
          )
          + formGroup('Instructions', `<textarea id="agent-edit-content" rows="12">${escapeHtml(agent.content)}</textarea>`),
        buttons: [{
          label: 'Save', primary: true, onClick: async () => {
            const fm = { ...agent.frontmatter };
            fm.name = document.getElementById('agent-edit-name').value;
            fm.description = document.getElementById('agent-edit-desc').value;
            const tools = document.getElementById('agent-edit-tools').value.trim();
            if (tools) fm.tools = tools; else delete fm.tools;
            const model = document.getElementById('agent-edit-model').value.trim();
            if (model) fm.model = model; else delete fm.model;
            try {
              await api(`/api/agents/project/${ProjectAgents.slug}/${filename}`, { method: 'PUT', body: { frontmatter: fm, content: document.getElementById('agent-edit-content').value } });
              toast('Agent saved');
              ProjectAgents.load(ProjectAgents.slug);
            } catch (e) { toast('Save failed: ' + e.message, 'error'); return false; }
          }
        }]
      });
    } catch (e) { toast('Could not load agent: ' + e.message, 'error'); }
  },

  showCreate() {
    openModal({
      title: 'Create Agent',
      body: formGroup('Filename', '<input type="text" id="agent-new-file" placeholder="my-agent.md">')
        + formGroup('Name', '<input type="text" id="agent-new-name" placeholder="Agent Name">')
        + formGroup('Description', '<input type="text" id="agent-new-desc" placeholder="What this agent does">'),
      buttons: [{
        label: 'Create', primary: true, onClick: async () => {
          let filename = document.getElementById('agent-new-file').value.trim();
          if (!filename) { toast('Filename required', 'error'); return false; }
          if (!filename.endsWith('.md')) filename += '.md';
          try {
            await api(`/api/agents/project/${ProjectAgents.slug}/${filename}`, { method: 'PUT', body: {
              frontmatter: { name: document.getElementById('agent-new-name').value, description: document.getElementById('agent-new-desc').value },
              content: ''
            }});
            toast('Agent created');
            ProjectAgents.load(ProjectAgents.slug);
          } catch (e) { toast('Create failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  async remove(filename) {
    if (!confirm(`Delete agent "${filename}"?`)) return;
    try {
      await api(`/api/agents/project/${ProjectAgents.slug}/${filename}`, { method: 'DELETE' });
      toast('Deleted');
      ProjectAgents.load(ProjectAgents.slug);
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
};

// --- Project Skills Tab ---

const ProjectSkills = {
  slug: null,

  async load(slug) {
    ProjectSkills.slug = slug;
    const container = document.getElementById('proj-skills-content');
    showLoading(container);
    try {
      const skills = await api(`/api/skills/project/${slug}`);
      if (skills.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No project-level skills</p><p style="color:var(--text-secondary);margin-top:8px">Skills are custom slash commands in .claude/skills/</p></div><div style="text-align:center;margin-top:12px"><button class="btn" onclick="ProjectSkills.showCreate()">+ New Skill</button></div>';
        return;
      }
      container.innerHTML = '<div class="card-grid">' + skills.map(s => `
        <div class="card" style="cursor:pointer" onclick="ProjectSkills.edit('${escapeHtml(s.name)}')">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div style="font-weight:600;margin-bottom:4px;color:var(--accent);font-family:var(--font-mono)">/${escapeHtml(s.name)}</div>
              <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(s.description)}</div>
            </div>
            <button class="prop-action-btn danger" onclick="event.stopPropagation(); ProjectSkills.remove('${escapeHtml(s.name)}')">&#10005;</button>
          </div>
        </div>
      `).join('') + '</div><div style="margin-top:12px"><button class="btn" onclick="ProjectSkills.showCreate()">+ New Skill</button></div>';
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  },

  async edit(name) {
    try {
      const skill = await api(`/api/skills/project/${ProjectSkills.slug}/${name}`);
      openModal({
        title: 'Edit Skill: /' + name,
        width: 700,
        body: formRow(
            formGroup('Name', `<input type="text" id="pskill-edit-name" value="${escapeHtml(skill.frontmatter.name || name)}">`),
            formGroup('Description', `<input type="text" id="pskill-edit-desc" value="${escapeHtml(skill.frontmatter.description || '')}">`)
          )
          + formRow(
            formGroup('Allowed Tools', `<input type="text" id="pskill-edit-tools" value="${escapeHtml(skill.frontmatter['allowed-tools'] || '')}" placeholder="Read, Grep, Bash(npm *)">`),
            formGroup('Model', `<input type="text" id="pskill-edit-model" value="${escapeHtml(skill.frontmatter.model || '')}" placeholder="default">`)
          )
          + formGroup('Content', `<textarea id="pskill-edit-content" rows="12">${escapeHtml(skill.content)}</textarea>`),
        buttons: [{
          label: 'Save', primary: true, onClick: async () => {
            const fm = { ...skill.frontmatter };
            fm.name = document.getElementById('pskill-edit-name').value;
            fm.description = document.getElementById('pskill-edit-desc').value;
            const tools = document.getElementById('pskill-edit-tools').value.trim();
            if (tools) fm['allowed-tools'] = tools; else delete fm['allowed-tools'];
            const model = document.getElementById('pskill-edit-model').value.trim();
            if (model) fm.model = model; else delete fm.model;
            const content = document.getElementById('pskill-edit-content').value;
            try {
              await api(`/api/skills/project/${ProjectSkills.slug}/${name}`, { method: 'PUT', body: { frontmatter: fm, content } });
              toast('Skill saved');
              ProjectSkills.load(ProjectSkills.slug);
            } catch (e) { toast('Save failed: ' + e.message, 'error'); return false; }
          }
        }]
      });
    } catch (e) { toast('Could not load skill: ' + e.message, 'error'); }
  },

  showCreate() {
    openModal({
      title: 'Create Skill',
      body: formGroup('Skill Name (folder name)', '<input type="text" id="pskill-new-name" placeholder="my-skill">')
        + formGroup('Description', '<input type="text" id="pskill-new-desc" placeholder="What this skill does">'),
      buttons: [{
        label: 'Create', primary: true, onClick: async () => {
          const name = document.getElementById('pskill-new-name').value.trim();
          const desc = document.getElementById('pskill-new-desc').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          try {
            await api(`/api/skills/project/${ProjectSkills.slug}/${name}`, { method: 'PUT', body: { frontmatter: { name, description: desc }, content: '# Instructions\n\n' } });
            toast('Skill created');
            ProjectSkills.load(ProjectSkills.slug);
          } catch (e) { toast('Create failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  async remove(name) {
    if (!confirm(`Delete skill "${name}"?`)) return;
    try {
      await api(`/api/skills/project/${ProjectSkills.slug}/${name}`, { method: 'DELETE' });
      toast('Skill deleted');
      ProjectSkills.load(ProjectSkills.slug);
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
};

// --- Project Output Styles Tab ---

const ProjectOutputStyles = {
  slug: null,

  async load(slug) {
    ProjectOutputStyles.slug = slug;
    const container = document.getElementById('proj-output-styles-content');
    showLoading(container);
    try {
      const styles = await api(`/api/output-styles/project/${slug}`);
      if (styles.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No project-level output styles</p><p style="color:var(--text-secondary);margin-top:8px">Output styles are response presets in .claude/output-styles/</p></div><div style="text-align:center;margin-top:12px"><button class="btn" onclick="ProjectOutputStyles.showCreate()">+ New Style</button></div>';
        return;
      }
      container.innerHTML = '<div class="card-grid">' + styles.map(s => `
        <div class="card" style="cursor:pointer" onclick="ProjectOutputStyles.edit('${escapeHtml(s.filename)}')">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div style="font-weight:600;margin-bottom:4px">${escapeHtml(s.name)}</div>
              <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(s.description)}</div>
            </div>
            <button class="prop-action-btn danger" onclick="event.stopPropagation(); ProjectOutputStyles.remove('${escapeHtml(s.filename)}')">&#10005;</button>
          </div>
        </div>
      `).join('') + '</div><div style="margin-top:12px"><button class="btn" onclick="ProjectOutputStyles.showCreate()">+ New Style</button></div>';
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  },

  async edit(filename) {
    try {
      const style = await api(`/api/output-styles/project/${ProjectOutputStyles.slug}/${filename}`);
      openModal({
        title: 'Edit Output Style: ' + (style.frontmatter.name || filename),
        width: 700,
        body: formRow(
            formGroup('Name', `<input type="text" id="pos-edit-name" value="${escapeHtml(style.frontmatter.name || '')}">`),
            formGroup('Description', `<input type="text" id="pos-edit-desc" value="${escapeHtml(style.frontmatter.description || '')}">`)
          )
          + formGroup('Content', `<textarea id="pos-edit-content" rows="12">${escapeHtml(style.content)}</textarea>`),
        buttons: [{
          label: 'Save', primary: true, onClick: async () => {
            const fm = { ...style.frontmatter, name: document.getElementById('pos-edit-name').value, description: document.getElementById('pos-edit-desc').value };
            try {
              await api(`/api/output-styles/project/${ProjectOutputStyles.slug}/${filename}`, { method: 'PUT', body: { frontmatter: fm, content: document.getElementById('pos-edit-content').value } });
              toast('Style saved');
              ProjectOutputStyles.load(ProjectOutputStyles.slug);
            } catch (e) { toast('Save failed: ' + e.message, 'error'); return false; }
          }
        }]
      });
    } catch (e) { toast('Could not load style: ' + e.message, 'error'); }
  },

  showCreate() {
    openModal({
      title: 'Create Output Style',
      body: formGroup('Filename', '<input type="text" id="pos-new-file" placeholder="my-style.md">')
        + formGroup('Name', '<input type="text" id="pos-new-name" placeholder="My Style">'),
      buttons: [{
        label: 'Create', primary: true, onClick: async () => {
          let filename = document.getElementById('pos-new-file').value.trim();
          const name = document.getElementById('pos-new-name').value.trim();
          if (!filename) { toast('Filename required', 'error'); return false; }
          if (!filename.endsWith('.md')) filename += '.md';
          try {
            await api(`/api/output-styles/project/${ProjectOutputStyles.slug}/${filename}`, { method: 'PUT', body: { frontmatter: { name, description: '' }, content: '' } });
            toast('Style created');
            ProjectOutputStyles.load(ProjectOutputStyles.slug);
          } catch (e) { toast('Create failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  async remove(filename) {
    if (!confirm(`Delete output style "${filename}"?`)) return;
    try {
      await api(`/api/output-styles/project/${ProjectOutputStyles.slug}/${filename}`, { method: 'DELETE' });
      toast('Deleted');
      ProjectOutputStyles.load(ProjectOutputStyles.slug);
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
};
