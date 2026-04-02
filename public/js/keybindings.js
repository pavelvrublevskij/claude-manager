// --- Keybindings ---

const Keybindings = {
  data: { bindings: [] },

  async load() {
    showLoading('keybindings-editor');
    try {
      Keybindings.data = await api('/api/keybindings');
      Keybindings.render();
    } catch (e) { toast('Could not load keybindings: ' + e.message, 'error'); }
  },

  render() {
    const container = document.getElementById('keybindings-editor');
    const bindings = Keybindings.data.bindings || [];

    let html = `<div class="info-note">
      Custom keybindings override Claude Code defaults. Each binding belongs to a <strong>context</strong> (Chat, Global, Autocomplete, etc.).
      Set an action to <code>null</code> to disable a default shortcut. Supports chords like <code>ctrl+k ctrl+s</code>.
      File: <code>~/.claude/keybindings.json</code> — auto-reloads on change. Reserved keys: <code>ctrl+c</code>, <code>ctrl+d</code>, <code>ctrl+m</code>.
    </div>`;

    if (bindings.length === 0) {
      container.innerHTML = html + `
        <div class="empty-state"><p>No custom keybindings configured</p></div>
        <div style="text-align:center;margin-top:12px">
          <button class="btn" onclick="Keybindings.addContext()">+ Add Context</button>
        </div>
      `;
      return;
    }

    container.innerHTML = html + bindings.map((ctx, ci) => {
      const keys = Object.entries(ctx.bindings || {});
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <strong style="color:var(--accent)">${escapeHtml(ctx.context)}</strong>
              <span class="prop-type">${keys.length} bindings</span>
            </div>
            <div class="btn-group">
              <button class="btn btn-sm" onclick="Keybindings.addBinding(${ci})">+ Add Binding</button>
              <button class="btn btn-sm btn-danger" onclick="Keybindings.removeContext(${ci})">Remove</button>
            </div>
          </div>
          ${keys.map(([key, action]) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
              <code style="min-width:160px;padding:4px 8px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">${escapeHtml(key)}</code>
              <span style="color:var(--text-muted)">&#8594;</span>
              <code style="flex:1;padding:4px 8px;background:var(--bg-primary);border-radius:var(--radius-sm);color:var(--success)">${action === null ? '<span style="color:var(--danger)">disabled</span>' : escapeHtml(String(action))}</code>
              <button class="prop-action-btn danger" onclick="Keybindings.removeBinding(${ci},'${escapeHtml(key)}')">&#10005;</button>
            </div>
          `).join('')}
        </div>
      `;
    }).join('') + '<div style="text-align:center"><button class="btn" onclick="Keybindings.addContext()">+ Add Context</button></div>';
  },

  addContext() {
    openModal({
      title: 'Add Keybinding Context',
      body: formGroup('Context', selectHtml('kb-new-context', KB_CONTEXTS, KB_CONTEXTS[0])),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const context = document.getElementById('kb-new-context').value;
          if (!Keybindings.data.bindings) Keybindings.data.bindings = [];
          Keybindings.data.bindings.push({ context, bindings: {} });
          Keybindings.render();
        }
      }]
    });
  },

  addBinding(ctxIndex) {
    openModal({
      title: 'Add Keybinding',
      body: formGroup('Key Combo', '<input type="text" id="kb-new-key" placeholder="ctrl+k">')
        + formGroup('Action', '<input type="text" id="kb-new-action" placeholder="chat:submit (or leave empty to disable)">'),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const key = document.getElementById('kb-new-key').value.trim();
          const action = document.getElementById('kb-new-action').value.trim();
          if (!key) { toast('Key required', 'error'); return false; }
          Keybindings.data.bindings[ctxIndex].bindings[key] = action || null;
          Keybindings.render();
        }
      }]
    });
  },

  removeContext(i) { Keybindings.data.bindings.splice(i, 1); Keybindings.render(); },
  removeBinding(ci, key) { delete Keybindings.data.bindings[ci].bindings[key]; Keybindings.render(); },

  async save() {
    try {
      await api('/api/keybindings', { method: 'PUT', body: Keybindings.data });
      toast('Keybindings saved');
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }
};
