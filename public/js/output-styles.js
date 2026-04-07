// --- Output Styles ---

const OutputStyles = {
  list: [],

  async load() {
    showLoading('output-styles-content');
    try {
      OutputStyles.list = await api('/api/output-styles/global');
      OutputStyles.render();
    } catch (e) { toast('Could not load output styles: ' + e.message, 'error'); }
  },

  render() {
    const container = document.getElementById('output-styles-content');
    const note = `<div class="info-note">
      Output styles control how Claude formats responses. Built-in styles: <strong>Default</strong>, <strong>Explanatory</strong>, <strong>Learning</strong>.
      Create custom styles with YAML frontmatter (name, description) and markdown instructions.
      Set active style in settings via <code>outputStyle</code> field, or use the picker in Claude Code.
      Stored in <code>~/.claude/output-styles/</code> (global) or <code>.claude/output-styles/</code> (per-project).
    </div>`;
    if (OutputStyles.list.length === 0) {
      container.innerHTML = note + '<div class="empty-state"><p>No custom output styles</p></div>';
      return;
    }
    container.innerHTML = note + '<div class="card-grid">' + OutputStyles.list.map(s => `
      <div class="card" style="cursor:pointer" onclick="OutputStyles.edit('${escapeHtml(s.filename)}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(s.name)}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(s.description)}</div>
          </div>
          <button class="prop-action-btn danger" onclick="event.stopPropagation(); OutputStyles.remove('${escapeHtml(s.filename)}')">&#10005;</button>
        </div>
      </div>
    `).join('') + '</div>';
  },

  async edit(filename) {
    const style = OutputStyles.list.find(s => s.filename === filename);
    if (!style) return;
    openModal({
      title: 'Edit Output Style',
      width: 700,
      body: formRow(
          formGroup('Name', `<input type="text" id="os-edit-name" value="${escapeHtml(style.frontmatter.name || '')}">`),
          formGroup('Description', `<input type="text" id="os-edit-desc" value="${escapeHtml(style.frontmatter.description || '')}">`)
        )
        + formGroup('Content', `<textarea id="os-edit-content" rows="12">${escapeHtml(style.content)}</textarea>`),
      buttons: [{
        label: 'Save', primary: true, onClick: async () => {
          const fm = { ...style.frontmatter, name: document.getElementById('os-edit-name').value, description: document.getElementById('os-edit-desc').value };
          try {
            await api(`/api/output-styles/global/${filename}`, { method: 'PUT', body: { frontmatter: fm, content: document.getElementById('os-edit-content').value } });
            toast('Style saved');
            OutputStyles.load();
          } catch (e) { toast('Save failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  showCreate() {
    openModal({
      title: 'Create Output Style',
      body: formGroup('Filename', '<input type="text" id="os-new-file" placeholder="my-style.md">')
        + formGroup('Name', '<input type="text" id="os-new-name" placeholder="My Style">'),
      buttons: [{
        label: 'Create', primary: true, onClick: async () => {
          let filename = document.getElementById('os-new-file').value.trim();
          const name = document.getElementById('os-new-name').value.trim();
          if (!filename) { toast('Filename required', 'error'); return false; }
          if (!filename.endsWith('.md')) filename += '.md';
          try {
            await api(`/api/output-styles/global/${filename}`, { method: 'PUT', body: { frontmatter: { name, description: '' }, content: '' } });
            toast('Style created');
            OutputStyles.load();
          } catch (e) { toast('Create failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  async remove(filename) {
    if (!confirm(`Delete output style "${filename}"?`)) return;
    try { await api(`/api/output-styles/global/${filename}`, { method: 'DELETE' }); toast('Deleted'); OutputStyles.load(); }
    catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
};
