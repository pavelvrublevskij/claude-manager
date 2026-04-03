const ClaudeMd = {
  currentProjectSlug: null,

  // --- Global ---

  async loadGlobal() {
    try {
      const data = await api('/api/claude-md/global');
      const editor = document.getElementById('global-claude-md-editor');
      editor.value = data.content;
      ClaudeMd.updateGlobalPreview();
      editor.addEventListener('input', ClaudeMd.updateGlobalPreview);
    } catch (e) {
      document.getElementById('global-claude-md-editor').value = '';
      document.getElementById('global-claude-md-preview').innerHTML =
        '<div class="empty-state"><p>No global CLAUDE.md found</p></div>';
    }
  },

  updateGlobalPreview() {
    const text = document.getElementById('global-claude-md-editor').value;
    document.getElementById('global-claude-md-preview').innerHTML = renderMarkdown(text);
  },

  async reloadGlobal() {
    await ClaudeMd.loadGlobal();
    toast('Reloaded');
  },

  async saveGlobal() {
    const content = document.getElementById('global-claude-md-editor').value;
    try {
      await api('/api/claude-md/global', { method: 'PUT', body: { content } });
      toast('Global CLAUDE.md saved');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  },

  // --- Project ---

  async loadProject(slug) {
    ClaudeMd.currentProjectSlug = slug;

    try {
      const data = await api(`/api/claude-md/project/${slug}`);
      document.getElementById('project-claude-md-path').textContent = data.path;
      const editor = document.getElementById('project-claude-md-editor');
      editor.value = data.content;
      ClaudeMd.updateProjectPreview();
      editor.addEventListener('input', ClaudeMd.updateProjectPreview);
    } catch (e) {
      document.getElementById('project-claude-md-editor').value = '';
      document.getElementById('project-claude-md-preview').innerHTML =
        '<div class="empty-state"><p>No project CLAUDE.md found at decoded path</p></div>';
      document.getElementById('project-claude-md-path').textContent = e.message;
    }
  },

  updateProjectPreview() {
    const text = document.getElementById('project-claude-md-editor').value;
    document.getElementById('project-claude-md-preview').innerHTML = renderMarkdown(text);
  },

  async reloadProject() {
    if (ClaudeMd.currentProjectSlug) {
      await ClaudeMd.loadProject(ClaudeMd.currentProjectSlug);
      toast('Reloaded');
    }
  },

  async saveProject() {
    const content = document.getElementById('project-claude-md-editor').value;
    try {
      await api(`/api/claude-md/project/${ClaudeMd.currentProjectSlug}`, {
        method: 'PUT',
        body: { content }
      });
      toast('Project CLAUDE.md saved');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  }
};
