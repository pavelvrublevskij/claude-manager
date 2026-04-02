// --- Skills ---

const Skills = {
  list: [],

  async load() {
    showLoading('skills-content');
    try {
      Skills.list = await api('/api/skills/global');
      Skills.render();
    } catch (e) { toast('Could not load skills: ' + e.message, 'error'); }
  },

  render() {
    const container = document.getElementById('skills-content');
    const note = `<div class="info-note">
      Skills are custom slash commands you can invoke with <code>/skill-name</code>.
      Each skill is a <code>SKILL.md</code> file with YAML frontmatter (name, description, allowed-tools, model) and markdown instructions.
      Stored in <code>~/.claude/skills/&lt;name&gt;/SKILL.md</code> (global) or <code>.claude/skills/</code> (per-project).
      Use <code>$ARGUMENTS</code> in content to receive user input.
    </div>`;
    if (Skills.list.length === 0) {
      container.innerHTML = note + '<div class="empty-state"><p>No custom skills configured</p></div>';
      return;
    }
    container.innerHTML = note + '<div class="card-grid">' + Skills.list.map(s => `
      <div class="card" style="cursor:pointer" onclick="Skills.edit('${escapeHtml(s.name)}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="font-weight:600;margin-bottom:4px;color:var(--accent);font-family:var(--font-mono)">/${escapeHtml(s.name)}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(s.description)}</div>
          </div>
          <button class="prop-action-btn danger" onclick="event.stopPropagation(); Skills.remove('${escapeHtml(s.name)}')">&#10005;</button>
        </div>
      </div>
    `).join('') + '</div>';
  },

  async edit(name) {
    try {
      const skill = await api(`/api/skills/global/${name}`);
      openModal({
        title: 'Edit Skill: /' + name,
        width: 700,
        body: formRow(
            formGroup('Name', `<input type="text" id="skill-edit-name" value="${escapeHtml(skill.frontmatter.name || name)}">`),
            formGroup('Description', `<input type="text" id="skill-edit-desc" value="${escapeHtml(skill.frontmatter.description || '')}">`)
          )
          + formRow(
            formGroup('Allowed Tools', `<input type="text" id="skill-edit-tools" value="${escapeHtml(skill.frontmatter['allowed-tools'] || '')}" placeholder="Read, Grep, Bash(npm *)">`),
            formGroup('Model', `<input type="text" id="skill-edit-model" value="${escapeHtml(skill.frontmatter.model || '')}" placeholder="default">`)
          )
          + formGroup('Content', `<textarea id="skill-edit-content" rows="12">${escapeHtml(skill.content)}</textarea>`),
        buttons: [{
          label: 'Save', primary: true, onClick: async () => {
            const fm = { ...skill.frontmatter };
            fm.name = document.getElementById('skill-edit-name').value;
            fm.description = document.getElementById('skill-edit-desc').value;
            const tools = document.getElementById('skill-edit-tools').value.trim();
            if (tools) fm['allowed-tools'] = tools; else delete fm['allowed-tools'];
            const model = document.getElementById('skill-edit-model').value.trim();
            if (model) fm.model = model; else delete fm.model;
            const content = document.getElementById('skill-edit-content').value;
            try {
              await api(`/api/skills/global/${name}`, { method: 'PUT', body: { frontmatter: fm, content } });
              toast('Skill saved');
              Skills.load();
            } catch (e) { toast('Save failed: ' + e.message, 'error'); return false; }
          }
        }]
      });
    } catch (e) { toast('Could not load skill: ' + e.message, 'error'); }
  },

  showCreate() {
    openModal({
      title: 'Create Skill',
      body: formGroup('Skill Name (folder name)', '<input type="text" id="skill-new-name" placeholder="my-skill">')
        + formGroup('Description', '<input type="text" id="skill-new-desc" placeholder="What this skill does">'),
      buttons: [{
        label: 'Create', primary: true, onClick: async () => {
          const name = document.getElementById('skill-new-name').value.trim();
          const desc = document.getElementById('skill-new-desc').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          try {
            await api(`/api/skills/global/${name}`, { method: 'PUT', body: { frontmatter: { name, description: desc }, content: '# Instructions\n\n' } });
            toast('Skill created');
            Skills.load();
          } catch (e) { toast('Create failed: ' + e.message, 'error'); return false; }
        }
      }]
    });
  },

  async remove(name) {
    if (!confirm(`Delete skill "${name}"?`)) return;
    try {
      await api(`/api/skills/global/${name}`, { method: 'DELETE' });
      toast('Skill deleted');
      Skills.load();
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
};
