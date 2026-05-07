const Usage = {
  currentGroup: 'month',
  currentModels: new Set(),
  currentProjects: new Map(),
  fromDate: null,
  toDate: null,
  fromTime: null,
  toTime: null,
  datePreset: 'month',
  allModels: [],
  allProjects: [],
  searchTerms: { models: '', projects: '' },
  openDropdown: null,
  viewMode: 'charts',

  async load() {
    Usage.currentModels = new Set();
    Usage.currentProjects = new Map();
    Usage.currentGroup = 'month';
    Usage.searchTerms = { models: '', projects: '' };
    Usage.applyDatePresetState('month');
    const savedMode = localStorage.getItem('usage-view-mode') || 'charts';
    Usage.setViewMode(savedMode, { silent: true });
    Usage.bindOutsideClick();
    await Usage.refresh();
  },

  applyDatePresetState(preset) {
    Usage.datePreset = preset;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmtDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const fmtDT = (d, h, m) => fmtDate(d) + 'T' + pad(h) + ':' + pad(m);

    let fromDT = null, toDT = null;
    if (preset === 'all') { /* nothing */ }
    else if (preset === 'today') { fromDT = fmtDT(now, 0, 0); toDT = fmtDT(now, 23, 59); }
    else if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 6); fromDT = fmtDT(f, 0, 0); toDT = fmtDT(now, 23, 59); }
    else if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 29); fromDT = fmtDT(f, 0, 0); toDT = fmtDT(now, 23, 59); }
    else if (preset === 'month') { fromDT = fmtDT(new Date(now.getFullYear(), now.getMonth(), 1), 0, 0); toDT = fmtDT(now, 23, 59); }
    else if (preset === 'year') { fromDT = fmtDT(new Date(now.getFullYear(), 0, 1), 0, 0); toDT = fmtDT(now, 23, 59); }

    Usage.fromDate = fromDT ? fromDT.slice(0, 10) : null;
    Usage.toDate = toDT ? toDT.slice(0, 10) : null;
    Usage.fromTime = null;
    Usage.toTime = null;

    const presetEl = document.getElementById('filter-date-preset');
    if (presetEl) presetEl.value = preset;
    document.getElementById('filter-from').value = fromDT || '';
    document.getElementById('filter-to').value = toDT || '';
  },

  setViewMode(mode, opts) {
    if (mode !== 'charts' && mode !== 'tables') mode = 'charts';
    Usage.viewMode = mode;
    if (!opts || !opts.silent) localStorage.setItem('usage-view-mode', mode);
    const view = document.getElementById('view-usage');
    if (view) view.dataset.viewMode = mode;
    document.querySelectorAll('#usage-view-toggle .view-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (mode === 'charts' && typeof UsageCharts !== 'undefined' && UsageCharts.lastData) {
      UsageCharts.rerenderForTheme();
    }
  },

  basename(p) {
    if (!p) return '';
    const m = String(p).match(/[^\\\/]+$/);
    return m ? m[0] : p;
  },

  buildQuery() {
    let q = '';
    for (const m of Usage.currentModels) q += '&models=' + encodeURIComponent(m);
    for (const slug of Usage.currentProjects.keys()) q += '&projects=' + encodeURIComponent(slug);
    if (Usage.fromDate) q += '&from=' + encodeURIComponent(Usage.fromDate);
    if (Usage.toDate) q += '&to=' + encodeURIComponent(Usage.toDate);
    if (Usage.fromTime) q += '&fromTime=' + encodeURIComponent(Usage.fromTime);
    if (Usage.toTime) q += '&toTime=' + encodeURIComponent(Usage.toTime);
    return q;
  },

  async refresh() {
    const viewBody = document.querySelector('#view-usage .view-body');
    const scrollTop = viewBody ? viewBody.scrollTop : 0;

    showLoading('usage-summary');
    document.getElementById('usage-periods').innerHTML = '';
    document.getElementById('usage-projects').innerHTML = '';

    document.querySelectorAll('#usage-period-tabs .tab-btn, #usage-period-tabs-chart .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.group === Usage.currentGroup);
    });

    const q = Usage.buildQuery();

    try {
      const [summary, periods, projects] = await Promise.all([
        api('/api/usage/summary?_=1' + q),
        api('/api/usage/by-period?group=' + Usage.currentGroup + q),
        api('/api/usage/by-project?_=1' + q)
      ]);
      Usage.allModels = summary.allModels || [];
      Usage.allProjects = summary.allProjects || [];
      Usage.renderSummary(summary);
      Usage.initTooltips();
      Usage.renderByModel(summary.byModel, summary.modelPricing);
      Usage.renderPricing(summary.modelPricing, summary.byModel, summary.pricingUpdated, summary.pricingSource);
      Usage.renderPeriods(periods.periods);
      Usage.renderProjects(projects.projects);
      if (typeof UsageCharts !== 'undefined') {
        UsageCharts.lastData = { summary: summary, periods: periods.periods, projects: projects.projects };
        if (Usage.viewMode === 'charts') {
          const view = document.getElementById('view-usage');
          if (view) view.dataset.viewMode = 'tables';
          requestAnimationFrame(() => {
            if (view) view.dataset.viewMode = 'charts';
            UsageCharts.rerenderForTheme();
          });
        }
      }
      Usage.renderTriggerLabels();
      Usage.renderDropdownList('models');
      Usage.renderDropdownList('projects');
      if (viewBody) viewBody.scrollTop = scrollTop;
    } catch (e) {
      toast('Could not load usage data: ' + e.message, 'error');
    }
  },

  async setGroup(group, btn) {
    Usage.currentGroup = group;
    document.querySelectorAll('#usage-period-tabs .tab-btn, #usage-period-tabs-chart .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.group === group);
    });
    const viewBody = document.querySelector('#view-usage .view-body');
    const scrollTop = viewBody ? viewBody.scrollTop : 0;
    showLoading('usage-periods');
    const q = Usage.buildQuery();
    try {
      const data = await api('/api/usage/by-period?group=' + group + q);
      Usage.renderPeriods(data.periods);
      if (typeof UsageCharts !== 'undefined') {
        UsageCharts.renderPeriod(data.periods, UsageCharts.palette());
        if (UsageCharts.lastData) UsageCharts.lastData.periods = data.periods;
      }
      if (viewBody) viewBody.scrollTop = scrollTop;
    } catch (e) {
      toast('Could not load period data: ' + e.message, 'error');
    }
  },

  toggleDropdown(key, event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('filter-' + key + '-panel');
    if (Usage.openDropdown === key) {
      panel.hidden = true;
      Usage.openDropdown = null;
    } else {
      if (Usage.openDropdown) {
        document.getElementById('filter-' + Usage.openDropdown + '-panel').hidden = true;
      }
      panel.hidden = false;
      Usage.openDropdown = key;
      const search = panel.querySelector('.multi-select-search');
      if (search) { search.value = Usage.searchTerms[key] || ''; search.focus(); }
    }
  },

  bindOutsideClick() {
    if (Usage._outsideBound) return;
    Usage._outsideBound = true;
    document.addEventListener('click', e => {
      if (!Usage.openDropdown) return;
      if (e.target.closest('.multi-select')) return;
      document.getElementById('filter-' + Usage.openDropdown + '-panel').hidden = true;
      Usage.openDropdown = null;
    });
  },

  filterOptions(key, term) {
    Usage.searchTerms[key] = (term || '').toLowerCase();
    Usage.renderDropdownList(key);
  },

  renderDropdownList(key) {
    const listEl = document.getElementById('filter-' + key + '-list');
    if (!listEl) return;
    const term = Usage.searchTerms[key] || '';
    let items;
    if (key === 'models') {
      items = Usage.allModels
        .filter(m => !term || m.toLowerCase().includes(term) || (Usage.fmtModel(m) || '').toLowerCase().includes(term))
        .map(m => ({
          value: m,
          label: Usage.fmtModel(m),
          checked: Usage.currentModels.has(m)
        }));
    } else {
      items = Usage.allProjects
        .map(p => ({ p, base: Usage.basename(p.name) }))
        .filter(({ p, base }) => !term || base.toLowerCase().includes(term))
        .sort((a, b) => a.base.localeCompare(b.base))
        .map(({ p, base }) => ({
          value: p.slug,
          extra: p.name,
          label: base,
          title: p.name,
          checked: Usage.currentProjects.has(p.slug)
        }));
    }
    if (!items.length) {
      listEl.innerHTML = '<div class="multi-select-empty">No matches</div>';
      return;
    }
    const jsQuote = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    listEl.innerHTML = items.map(it => {
      const valAttr = escapeHtml(jsQuote(it.value));
      const extraAttr = it.extra ? escapeHtml(jsQuote(it.extra)) : '';
      const onchange = key === 'models'
        ? `Usage.toggleModel('${valAttr}')`
        : `Usage.toggleProject('${valAttr}', '${extraAttr}')`;
      const titleAttr = it.title ? ` title="${escapeHtml(it.title)}"` : '';
      return `<label class="multi-select-option"${titleAttr}>
        <input type="checkbox" ${it.checked ? 'checked' : ''} onchange="${onchange}">
        <span>${escapeHtml(it.label)}</span>
      </label>`;
    }).join('');
  },

  renderTriggerLabels() {
    const mLabel = document.getElementById('filter-models-label');
    if (mLabel) {
      mLabel.textContent = Usage.currentModels.size === 0
        ? 'All models'
        : Usage.currentModels.size === 1
          ? Usage.fmtModel(Array.from(Usage.currentModels)[0])
          : Usage.currentModels.size + ' models selected';
    }
    const pLabel = document.getElementById('filter-projects-label');
    if (pLabel) {
      pLabel.textContent = Usage.currentProjects.size === 0
        ? 'All projects'
        : Usage.currentProjects.size === 1
          ? Usage.basename(Array.from(Usage.currentProjects.values())[0])
          : Usage.currentProjects.size + ' projects selected';
    }
  },

  toggleModel(model) {
    if (Usage.currentModels.has(model)) Usage.currentModels.delete(model);
    else Usage.currentModels.add(model);
    Usage.refresh();
  },

  toggleProject(slug, name) {
    if (Usage.currentProjects.has(slug)) Usage.currentProjects.delete(slug);
    else Usage.currentProjects.set(slug, name || slug);
    Usage.refresh();
  },

  setDatePreset(preset) {
    if (preset === 'custom') { Usage.datePreset = 'custom'; return; }
    const autoGroup = { today: 'hour', '7d': 'day', '30d': 'day', month: 'day', year: 'month', all: 'month' };
    if (autoGroup[preset]) {
      Usage.currentGroup = autoGroup[preset];
      document.querySelectorAll('#usage-period-tabs .tab-btn, #usage-period-tabs-chart .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.group === Usage.currentGroup);
      });
    }
    Usage.applyDatePresetState(preset);
    Usage.refresh();
  },

  applyCustomDates() {
    const f = document.getElementById('filter-from').value || null; // "YYYY-MM-DDTHH:MM"
    const t = document.getElementById('filter-to').value || null;
    Usage.fromDate = f ? f.slice(0, 10) : null;
    Usage.toDate = t ? t.slice(0, 10) : null;
    Usage.fromTime = f && f.length > 10 ? f.slice(11, 16) : null;
    Usage.toTime = t && t.length > 10 ? t.slice(11, 16) : null;
    Usage.datePreset = 'custom';
    document.getElementById('filter-date-preset').value = 'custom';
    Usage.refresh();
  },

  clearFilters() {
    Usage.currentModels = new Set();
    Usage.currentProjects = new Map();
    Usage.searchTerms = { models: '', projects: '' };
    Usage.applyDatePresetState('month');
    Usage.refresh();
  },

  togglePricing() {
    const el = document.getElementById('usage-pricing');
    const chev = document.getElementById('usage-pricing-chevron');
    const hidden = el.style.display === 'none';
    el.style.display = hidden ? '' : 'none';
    chev.innerHTML = hidden ? '&#9660;' : '&#9654;';
  },

  renderSummary(data) {
    const t = data.totals;
    const c = data.cost;
    const items = [
      { label: 'Input Tokens', value: fmtTokens(t.input_tokens), sub: Usage.fmtCost(c.input), color: 'color-input',
        tip: 'Tokens sent to Claude in your prompts, system instructions, and tool results. This is what you "say" to the model each turn.' },
      { label: 'Output Tokens', value: fmtTokens(t.output_tokens), sub: Usage.fmtCost(c.output), color: 'color-output',
        tip: 'Tokens generated by Claude in responses — text, code, tool calls, and thinking. The most expensive token type.' },
      { label: 'Cache Write', value: fmtTokens(t.cache_creation_input_tokens), sub: Usage.fmtCost(c.cache_write), color: 'color-cache-write',
        tip: 'Input tokens written to the prompt cache on first use. Slightly more expensive than regular input, but enables cheaper cache reads on subsequent turns.' },
      { label: 'Cache Read', value: fmtTokens(t.cache_read_input_tokens), sub: Usage.fmtCost(c.cache_read), color: 'color-cache-read',
        tip: 'Input tokens served from cache instead of being re-processed. 10x cheaper than regular input. Typically the largest number — Claude Code aggressively caches conversation context.' },
      { label: 'Total Cost', value: Usage.fmtCost(c.total), sub: data.sessionCount + ' sessions / ' + data.projectCount + ' projects', color: 'color-cost',
        tip: 'Estimated total based on actual model pricing per message. Each message is costed using the model that generated it.' }
    ];
    document.getElementById('usage-summary').innerHTML = items.map(i => `
      <div class="stat-card ${i.color} has-tooltip">
        <div class="stat-card-value">${escapeHtml(i.value)}</div>
        <div class="stat-card-label">${escapeHtml(i.label)}</div>
        <div class="stat-card-sub">${escapeHtml(i.sub)}</div>
        <div class="stat-tooltip">${escapeHtml(i.tip)}</div>
      </div>
    `).join('');
  },

  renderByModel(byModel, modelPricing) {
    const el = document.getElementById('usage-by-model');
    if (!el) return;
    if (!byModel || Object.keys(byModel).length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No usage data</p></div>';
      return;
    }
    el.innerHTML = `<table class="usage-table">
      <thead><tr>
        <th>Model</th>
        <th class="col-input">Input</th>
        <th class="col-output">Output</th>
        <th class="col-cache-write">Cache Write</th>
        <th class="col-cache-read">Cache Read</th>
        <th class="col-cost">Cost</th>
      </tr></thead>
      <tbody>${Object.entries(byModel).map(([model, tokens]) => {
        const r = matchPricing(model, modelPricing) || {};
        const cost = (tokens.input_tokens || 0) * (r.input || 0) / 1e6
          + (tokens.output_tokens || 0) * (r.output || 0) / 1e6
          + (tokens.cache_creation_input_tokens || 0) * (r.cache_write || 0) / 1e6
          + (tokens.cache_read_input_tokens || 0) * (r.cache_read || 0) / 1e6;
        return `<tr>
          <td>${Usage.fmtModel(model)}</td>
          <td class="col-input">${fmtTokens(tokens.input_tokens)}</td>
          <td class="col-output">${fmtTokens(tokens.output_tokens)}</td>
          <td class="col-cache-write">${fmtTokens(tokens.cache_creation_input_tokens)}</td>
          <td class="col-cache-read">${fmtTokens(tokens.cache_read_input_tokens)}</td>
          <td class="col-cost">${Usage.fmtCost(cost)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  renderPricing(modelPricing, byModel, pricingUpdated, pricingSource) {
    const el = document.getElementById('usage-pricing');
    const cols = [
      { key: 'input', label: 'Input', cls: 'col-input' },
      { key: 'output', label: 'Output', cls: 'col-output' },
      { key: 'cache_write', label: 'Cache Write', cls: 'col-cache-write' },
      { key: 'cache_read', label: 'Cache Read', cls: 'col-cache-read' }
    ];

    const models = Object.keys(byModel || {}).filter(m => matchPricing(m, modelPricing));

    const pricingHtml = `<table class="usage-table">
      <thead><tr>
        <th>Model</th>
        ${cols.map(c => `<th class="${c.cls}">${c.label}</th>`).join('')}
      </tr></thead>
      <tbody>${models.map(m => {
        const r = matchPricing(m, modelPricing);
        return `<tr>
          <td>${Usage.fmtModel(m)}</td>
          ${cols.map(c => `<td class="${c.cls}">$${r[c.key].toFixed(2)}</td>`).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table>`;

    const updatedStr = pricingUpdated ? `Last fetched: <strong>${new Date(pricingUpdated).toLocaleString()}</strong>.` : 'No pricing data fetched yet.';
    const sourceStr = pricingSource ? ` <a href="${escapeHtml(pricingSource)}" target="_blank" class="usage-project-link">Verify on Anthropic</a>` : '';

    el.innerHTML = pricingHtml + `
    <div class="info-note" style="margin-top:8px">
      Rates per 1M tokens (5-minute cache writes). Costs are calculated per message using the actual model.
      Subscription plans may differ from API pricing.<br>
      ${updatedStr}${sourceStr}
    </div>`;
  },

  async fetchPricing() {
    try {
      const result = await api('/api/pricing/fetch', { method: 'POST' });
      toast(result.changed ? 'Pricing updated — changes detected' : 'Pricing checked — no changes');
      if (result.changed) Usage.refresh();
    } catch (e) {
      toast('Failed to fetch pricing: ' + e.message, 'error');
    }
  },

  renderPeriods(periods) {
    const el = document.getElementById('usage-periods');
    if (!periods.length) {
      el.innerHTML = '<div class="empty-state"><p>No usage data</p></div>';
      return;
    }
    const maxCost = Math.max(...periods.map(p => p.cost)) || 1;
    el.innerHTML = `<table class="usage-table">
      <thead><tr>
        <th>Period</th>
        <th class="col-input">Input</th>
        <th class="col-output">Output</th>
        <th class="col-cache-write">Cache Write</th>
        <th class="col-cache-read">Cache Read</th>
        <th class="col-cost">Cost</th>
      </tr></thead>
      <tbody>${periods.map(p => `<tr>
        <td>${escapeHtml(p.label)}</td>
        <td class="col-input">${fmtTokens(p.input_tokens)}</td>
        <td class="col-output">${fmtTokens(p.output_tokens)}</td>
        <td class="col-cache-write">${fmtTokens(p.cache_creation_input_tokens)}</td>
        <td class="col-cache-read">${fmtTokens(p.cache_read_input_tokens)}</td>
        <td class="col-cost">
          ${Usage.fmtCost(p.cost)}
          <div class="usage-bar" style="width:${(p.cost / maxCost * 100).toFixed(1)}%"></div>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  renderProjects(projects) {
    const el = document.getElementById('usage-projects');
    if (!projects.length) {
      el.innerHTML = '<div class="empty-state"><p>No usage data</p></div>';
      return;
    }
    const maxCost = Math.max(...projects.map(p => p.cost)) || 1;
    el.innerHTML = `<table class="usage-table">
      <thead><tr>
        <th>Project</th>
        <th>Sessions</th>
        <th class="col-input">Input</th>
        <th class="col-output">Output</th>
        <th class="col-cost">Cost</th>
      </tr></thead>
      <tbody>${projects.map(p => `<tr>
        <td><a href="#project-detail/${escapeHtml(p.slug)}" class="usage-project-link" title="${escapeHtml(p.name)}">${escapeHtml(Usage.basename(p.name))}</a></td>
        <td>${p.sessionCount}</td>
        <td class="col-input">${fmtTokens(p.input_tokens)}</td>
        <td class="col-output">${fmtTokens(p.output_tokens)}</td>
        <td class="col-cost">
          ${Usage.fmtCost(p.cost)}
          <div class="usage-bar" style="width:${(p.cost / maxCost * 100).toFixed(1)}%"></div>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  fmtCost(n) {
    if (!n) return '$0.00';
    return '$' + n.toFixed(2);
  },

  fmtModel(model) {
    return shortModel(model) || model;
  },

  initTooltips() {
    document.getElementById('usage-summary').addEventListener('mousemove', e => {
      const card = e.target.closest('.has-tooltip');
      if (!card) return;
      const tip = card.querySelector('.stat-tooltip');
      if (!tip) return;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
    });
    document.getElementById('usage-summary').addEventListener('mouseleave', e => {
      document.querySelectorAll('.stat-tooltip').forEach(t => t.style.display = 'none');
    }, true);
    document.getElementById('usage-summary').addEventListener('mouseout', e => {
      const card = e.target.closest('.has-tooltip');
      const related = e.relatedTarget?.closest?.('.has-tooltip');
      if (card && card !== related) {
        const tip = card.querySelector('.stat-tooltip');
        if (tip) tip.style.display = 'none';
      }
    });
  }
};
