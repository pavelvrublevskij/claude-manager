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
