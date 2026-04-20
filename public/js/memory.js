const Memory = {
  currentSlug: null,
  currentFile: null,
  files: [],

  async load(slug) {
    Memory.currentSlug = slug;
    Memory.currentFile = null;

    const project = Projects.data.find(p => p.slug === slug);
    if (project) {
      document.getElementById('project-detail-title').textContent = decodeName(slug);
      document.getElementById('project-detail-path').textContent = project.path;
    }

    try {
      Memory.files = await api(`/api/projects/${slug}/memory`);
    } catch (e) {
      Memory.files = [];
    }

    Memory.renderList();
    Memory.clearEditor();
  },

  renderList() {
    const list = document.getElementById('memory-file-list');
    if (Memory.files.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No memory files</p></div>';
      return;
    }
    list.innerHTML = Memory.files.map(f => `
      <div class="memory-item ${Memory.currentFile === f.filename ? 'active' : ''}"
           onclick="Memory.select('${f.filename}')">
        <div class="memory-title">${escapeHtml(f.name)}</div>
        <span class="memory-type type-${f.type}">${f.type}</span>
      </div>
    `).join('');
  },

  async select(filename) {
    Memory.currentFile = filename;
    Memory.renderList();

    try {
      const file = await api(`/api/projects/${Memory.currentSlug}/memory/${filename}`);
      Memory.renderEditor(file);
    } catch (e) {
      toast('Could not load file: ' + e.message, 'error');
    }
  },

  renderEditor(file) {
    const pane = document.getElementById('memory-editor-pane');
    pane.innerHTML = `
      <div class="toolbar">
        <div class="btn-group">
          <button class="btn btn-primary" onclick="Memory.save()">Save</button>
          <button class="btn btn-danger" onclick="Memory.confirmDelete('${file.filename}')">Delete</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="mem-name" value="${escapeHtml(file.name)}">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="mem-type">
            <option value="user" ${file.type === 'user' ? 'selected' : ''}>user</option>
            <option value="feedback" ${file.type === 'feedback' ? 'selected' : ''}>feedback</option>
            <option value="project" ${file.type === 'project' ? 'selected' : ''}>project</option>
            <option value="reference" ${file.type === 'reference' ? 'selected' : ''}>reference</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="mem-description" value="${escapeHtml(file.description)}">
      </div>
      <div class="form-group" style="flex:1;display:flex;flex-direction:column">
        <label>Content</label>
        <textarea id="mem-content" style="flex:1;min-height:200px">${escapeHtml(file.content)}</textarea>
      </div>
    `;
  },

  clearEditor() {
    document.getElementById('memory-editor-pane').innerHTML = `
      <div class="empty-state">
        <div class="icon">&#128196;</div>
        <p>Select a memory file to edit</p>
      </div>
    `;
  },

  async save() {
    const name = document.getElementById('mem-name').value;
    const type = document.getElementById('mem-type').value;
    const description = document.getElementById('mem-description').value;
    const content = document.getElementById('mem-content').value;

    try {
      await api(`/api/projects/${Memory.currentSlug}/memory/${Memory.currentFile}`, {
        method: 'PUT',
        body: { name, type, description, content }
      });
      toast('Memory file saved');
      Memory.load(Memory.currentSlug);
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  },

  confirmDelete(filename) {
    openModal({
      title: 'Delete memory file?',
      body: `<p>This will delete <strong>${escapeHtml(filename)}</strong>. A backup will be created.</p>`,
      buttons: [{
        label: 'Delete', danger: true, onClick: () => {
          Memory.doDelete(filename);
        }
      }]
    });
  },

  async doDelete(filename) {
    try {
      await api(`/api/projects/${Memory.currentSlug}/memory/${filename}`, { method: 'DELETE' });
      toast('Memory file deleted');
      Memory.load(Memory.currentSlug);
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  },

  showCreate() {
    openModal({
      title: 'Create Memory File',
      body: formGroup('Filename', '<input type="text" id="new-mem-filename" placeholder="my_memory.md">')
        + formGroup('Name', '<input type="text" id="new-mem-name" placeholder="Memory name">')
        + formRow(formGroup('Type', selectHtml('new-mem-type', MEMORY_TYPES, 'user')))
        + formGroup('Description', '<input type="text" id="new-mem-description" placeholder="One-line description">'),
      buttons: [{
        label: 'Create', primary: true, onClick: () => {
          Memory.doCreate();
        }
      }]
    });
  },

  async exportAll() {
    if (!Memory.currentSlug) return;
    try {
      const res = await fetch(`/api/projects/${Memory.currentSlug}/memory-export`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const fileCount = parseInt(res.headers.get('X-File-Count') || '0', 10);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memory-${Memory.currentSlug}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`Exported ${fileCount} file${fileCount === 1 ? '' : 's'}`);
    } catch (e) {
      toast('Export failed: ' + e.message, 'error');
    }
  },

  triggerImport() {
    if (!Memory.currentSlug) return;
    const input = document.getElementById('memory-import-input');
    input.value = '';
    input.click();
  },

  handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    file.arrayBuffer().then(buf => Memory.doImport(buf, false))
      .catch(e => toast('Could not read file: ' + e.message, 'error'));
  },

  async doImport(buffer, overwrite) {
    try {
      const res = await fetch(`/api/projects/${Memory.currentSlug}/memory-import?overwrite=${overwrite ? '1' : '0'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: buffer
      });
      const data = await res.json();
      if (res.status === 409 && data.conflicts) {
        Memory.confirmOverwrite(buffer, data.conflicts);
        return;
      }
      if (!res.ok) throw new Error(data.error || res.statusText);
      toast(`Imported ${data.imported} file${data.imported === 1 ? '' : 's'}`);
      Memory.load(Memory.currentSlug);
    } catch (e) {
      toast('Import failed: ' + e.message, 'error');
    }
  },

  confirmOverwrite(buffer, conflicts) {
    const list = conflicts.map(c => `<li><code>${escapeHtml(c)}</code></li>`).join('');
    openModal({
      title: 'Overwrite existing memory files?',
      body: `<p>The following ${conflicts.length} file${conflicts.length === 1 ? '' : 's'} already exist and will be overwritten (backups are created):</p>
             <ul style="margin:8px 0 0 16px;max-height:200px;overflow:auto">${list}</ul>`,
      buttons: [{
        label: 'Overwrite', danger: true, onClick: () => {
          Memory.doImport(buffer, true);
        }
      }]
    });
  },

  async doCreate() {
    let filename = document.getElementById('new-mem-filename').value.trim();
    const name = document.getElementById('new-mem-name').value.trim();
    const type = document.getElementById('new-mem-type').value;
    const description = document.getElementById('new-mem-description').value.trim();

    if (!filename) { toast('Filename is required', 'error'); return; }
    if (!filename.endsWith('.md')) filename += '.md';

    try {
      await api(`/api/projects/${Memory.currentSlug}/memory`, {
        method: 'POST',
        body: { filename, name, description, type, content: '' }
      });
      toast('Memory file created');
      Memory.load(Memory.currentSlug);
    } catch (e) {
      toast('Create failed: ' + e.message, 'error');
    }
  }
};
