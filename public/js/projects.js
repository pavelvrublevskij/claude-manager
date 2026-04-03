const ProjectNav = {
  toggle() {
    const body = document.getElementById('project-nav-body');
    const arrow = document.getElementById('project-nav-arrow');
    const open = body.classList.toggle('collapsed');
    arrow.innerHTML = open ? '&#9654;' : '&#9660;';
  },
  expand() {
    const body = document.getElementById('project-nav-body');
    const arrow = document.getElementById('project-nav-arrow');
    body.classList.remove('collapsed');
    arrow.innerHTML = '&#9660;';
  }
};

const Projects = {
  data: [],

  async load() {
    showLoading('projects-grid');
    try {
      Projects.data = await api('/api/projects');
      Projects.renderGrid();
      Projects.renderNav();
    } catch (e) {
      toast('Could not load projects: ' + e.message, 'error');
    }
  },

  renderGrid() {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = Projects.data.map(p => `
      <div class="card project-card" onclick="App.navigate('project-detail', { slug: '${p.slug}' })">
        <div class="project-name">${decodeName(p.slug)}</div>
        <div class="project-path">${escapeHtml(p.path)}</div>
        <div class="project-stats">
          <div class="stat">
            <span class="stat-value">${p.memoryCount}</span> memories
          </div>
          <div class="stat">
            <span class="stat-value">${p.sessionCount}</span> sessions
          </div>
          ${p.hasClaudeMd ? '<div class="stat" style="color:var(--success)">CLAUDE.md</div>' : ''}
          ${p.hasAiMemory ? '<div class="stat" style="color:var(--accent)">.ai_project_memory</div>' : ''}
        </div>
      </div>
    `).join('');
  },

  renderNav() {
    const list = document.getElementById('project-nav-list');
    list.innerHTML = Projects.data.map(p => `
      <div class="nav-item" data-slug="${p.slug}" onclick="App.navigate('project-detail', { slug: '${p.slug}' })">
        <span class="icon">&#128193;</span>
        <span>${decodeName(p.slug)}</span>
        ${p.memoryCount > 0 ? `<span class="badge">${p.memoryCount}</span>` : ''}
      </div>
    `).join('');
    const countEl = document.getElementById('project-nav-count');
    if (countEl) countEl.textContent = Projects.data.length;
  }
};
