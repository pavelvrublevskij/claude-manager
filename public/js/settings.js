const SETTINGS_DEFAULTS = { outputStyle: '' };

const Settings = {
  data: {},
  showRaw: false,

  async load() {
    showLoading('settings-visual');
    try {
      const res = await api('/api/settings');
      Settings.data = JSON.parse(res.content);
      for (const [key, val] of Object.entries(SETTINGS_DEFAULTS)) {
        if (!(key in Settings.data)) Settings.data[key] = val;
      }
      Settings.render();
      document.getElementById('settings-editor').value = JSON.stringify(Settings.data, null, 2);
    } catch (e) {
      Settings.data = {};
      Settings.render();
      toast('Could not load settings: ' + e.message, 'error');
    }
  },

  async reload() {
    await Settings.load();
    toast('Settings reloaded');
  },

  async save() {
    if (Settings.showRaw) {
      const raw = document.getElementById('settings-editor').value;
      try {
        Settings.data = JSON.parse(raw);
      } catch (e) {
        toast('Invalid JSON: ' + e.message, 'error');
        return;
      }
    }
    try {
      const content = JSON.stringify(Settings.data, null, 2);
      await api('/api/settings', { method: 'PUT', body: { content } });
      toast('Settings saved');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  },

  toggleReference() {
    const el = document.getElementById('settings-reference');
    if (el.style.display === 'none') {
      el.style.display = '';
      if (!el.innerHTML) el.innerHTML = Settings.referenceHtml();
    } else {
      el.style.display = 'none';
    }
  },

  referenceHtml() {
    const sections = [
      { title: 'General', keys: [
        ['model', 'string', 'Claude model to use: <code>default</code>, <code>best</code>, <code>sonnet</code>, <code>opus</code>, <code>haiku</code>, or specific model ID'],
        ['effortLevel', 'string', 'Reasoning effort: <code>"low"</code>, <code>"medium"</code>, <code>"high"</code>'],
        ['availableModels', 'string[]', 'Restrict which models users can select'],
        ['modelOverrides', 'object', 'Map Anthropic model IDs to Bedrock/Vertex/Foundry deployment names'],
        ['defaultMode', 'string', 'Permission mode: <code>default</code>, <code>acceptEdits</code>, <code>plan</code>, <code>auto</code>, <code>dontAsk</code>, <code>bypassPermissions</code>'],
        ['env', 'object', 'Environment variables as key-value pairs'],
        ['additionalDirectories', 'string[]', 'Extra paths to grant file access beyond working directory'],
        ['theme', 'string', 'Terminal theme name'],
        ['notificationCommand', 'string', 'Shell command for desktop notifications'],
        ['disableAllHooks', 'boolean', 'Disable all hooks from running'],
      ]},
      { title: 'Permissions', keys: [
        ['permissions.defaultMode', 'string', 'Default permission mode for the session'],
        ['permissions.allow', 'string[]', 'Auto-approve rules, e.g. <code>"Bash(npm run build)"</code>, <code>"Read(.env)"</code>'],
        ['permissions.ask', 'string[]', 'Rules requiring user confirmation'],
        ['permissions.deny', 'string[]', 'Rules to block entirely'],
        ['permissions.disableBypassPermissionsMode', 'string', 'Set <code>"disable"</code> to prevent bypass mode'],
        ['permissions.disableAutoMode', 'string', 'Set <code>"disable"</code> to prevent auto mode'],
      ]},
      { title: 'Sandbox', keys: [
        ['sandbox.enabled', 'boolean', 'Enable filesystem/network sandboxing'],
        ['sandbox.filesystem.allowRead', 'string[]', 'Paths Bash can read'],
        ['sandbox.filesystem.denyRead', 'string[]', 'Paths to block from reading'],
        ['sandbox.filesystem.allowWrite', 'string[]', 'Paths Bash can write to'],
        ['sandbox.filesystem.denyWrite', 'string[]', 'Paths to block from writing'],
        ['sandbox.network.allowedDomains', 'string[]', 'Domains allowed for network access'],
        ['sandbox.network.deniedDomains', 'string[]', 'Domains to block'],
      ]},
      { title: 'Auto Mode', keys: [
        ['autoMode.environment', 'string[]', 'Descriptions of trusted infrastructure'],
        ['autoMode.allow', 'string[]', 'Natural-language allow rules (exceptions to soft_deny)'],
        ['autoMode.soft_deny', 'string[]', 'Natural-language block rules for security checks'],
      ]},
      { title: 'Hooks (event keys)', keys: [
        ['hooks.SessionStart', 'hook[]', 'When session begins or resumes'],
        ['hooks.UserPromptSubmit', 'hook[]', 'When user submits a prompt'],
        ['hooks.PreToolUse', 'hook[]', 'Before tool execution (can block)'],
        ['hooks.PostToolUse', 'hook[]', 'After tool succeeds'],
        ['hooks.Stop', 'hook[]', 'When Claude finishes responding'],
        ['hooks.Notification', 'hook[]', 'When Claude needs attention'],
        ['hooks.SubagentStart', 'hook[]', 'When a subagent spawns'],
        ['hooks.SubagentStop', 'hook[]', 'When a subagent finishes'],
      ]},
      { title: 'Plugins', keys: [
        ['enabledPlugins', 'string[]', 'List of installed plugin IDs to enable'],
        ['extraKnownMarketplaces', 'string[]', 'Additional plugin marketplace URLs'],
        ['strictKnownMarketplaces', 'boolean', 'Restrict to known marketplaces only'],
      ]},
    ];
    let html = '';
    for (const s of sections) {
      html += '<div class="ref-section"><h4>' + s.title + '</h4><table class="ref-table"><thead><tr><th>Key</th><th>Type</th><th>Description</th></tr></thead><tbody>';
      for (const [key, type, desc] of s.keys) {
        html += '<tr><td><code>' + key + '</code></td><td><code>' + type + '</code></td><td>' + desc + '</td></tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '<div class="ref-footer">';
    html += '<div style="margin-bottom:6px"><strong>Hook object format:</strong><br>';
    html += '<code>matcher</code> — filter pattern<br>';
    html += '<code>type</code> — <code>command</code> | <code>http</code> | <code>prompt</code><br>';
    html += '<code>command</code> — shell command to run<br>';
    html += '<code>url</code> — HTTP endpoint<br>';
    html += '<code>timeout</code> — seconds</div>';
    html += '<div style="margin-bottom:6px"><strong>Permission rules:</strong> <code>Tool</code> or <code>Tool(pattern)</code><br>';
    html += 'e.g. <code>Bash(npm *)</code> · <code>Read(/src/*)</code> · <code>WebFetch(domain:github.com)</code></div>';
    html += '<div>Docs: <a href="https://docs.anthropic.com/en/docs/claude-code/settings" target="_blank" rel="noopener">Settings</a>';
    html += ' · <a href="https://docs.anthropic.com/en/docs/claude-code/hooks" target="_blank" rel="noopener">Hooks</a>';
    html += ' · <a href="https://docs.anthropic.com/en/docs/claude-code/security" target="_blank" rel="noopener">Permissions &amp; Security</a></div>';
    html += '</div>';
    return html;
  },

  toggleRaw() {
    Settings.showRaw = !Settings.showRaw;
    document.getElementById('settings-visual').style.display = Settings.showRaw ? 'none' : '';
    document.getElementById('settings-raw').style.display = Settings.showRaw ? '' : 'none';
    if (Settings.showRaw) {
      document.getElementById('settings-editor').value = JSON.stringify(Settings.data, null, 2);
    } else {
      try {
        Settings.data = JSON.parse(document.getElementById('settings-editor').value);
        Settings.render();
      } catch (_) {}
    }
  },

  render() {
    const container = document.getElementById('settings-visual');
    container.innerHTML = '';
    container.appendChild(Settings.buildTree(Settings.data, []));
  },

  buildTree(obj, path) {
    const frag = document.createDocumentFragment();
    for (const key of Object.keys(obj)) {
      frag.appendChild(Settings.buildNode(key, obj[key], path));
    }
    return frag;
  },

  buildNode(key, value, parentPath) {
    const fullPath = [...parentPath, key];
    const type = Settings.getType(value);
    const node = document.createElement('div');
    node.className = 'prop-node';

    const isObj = type === 'object';
    const isArr = type === 'array';
    const isExpandable = isObj || isArr;

    // Header
    const header = document.createElement('div');
    header.className = 'prop-header';

    // Toggle
    const toggle = document.createElement('button');
    toggle.className = 'prop-toggle' + (isExpandable ? ' open' : ' leaf');
    toggle.innerHTML = '&#9654;';
    if (isExpandable) {
      toggle.onclick = () => {
        toggle.classList.toggle('open');
        const children = node.querySelector('.prop-children');
        if (children) children.style.display = toggle.classList.contains('open') ? '' : 'none';
      };
    }
    header.appendChild(toggle);

    // Key
    const keyEl = document.createElement('span');
    keyEl.className = 'prop-key';
    keyEl.textContent = key;
    header.appendChild(keyEl);

    // Type badge
    const typeEl = document.createElement('span');
    typeEl.className = 'prop-type';
    typeEl.textContent = type;
    header.appendChild(typeEl);

    // Value editor (for primitives)
    if (!isExpandable) {
      const valueEl = document.createElement('div');
      valueEl.className = 'prop-value';
      valueEl.appendChild(Settings.buildValueInput(value, type, fullPath));
      header.appendChild(valueEl);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'prop-actions';

    const delBtn = document.createElement('button');
    delBtn.className = 'prop-action-btn danger';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '&#10005;';
    delBtn.onclick = () => {
      Settings.deletePath(fullPath);
      Settings.render();
    };
    actions.appendChild(delBtn);
    header.appendChild(actions);

    node.appendChild(header);

    // Children for objects/arrays
    if (isExpandable) {
      const children = document.createElement('div');
      children.className = 'prop-children';

      if (isObj) {
        for (const k of Object.keys(value)) {
          children.appendChild(Settings.buildNode(k, value[k], fullPath));
        }
      } else if (isArr) {
        value.forEach((item, i) => {
          children.appendChild(Settings.buildNode(String(i), item, fullPath));
        });
      }

      // Add child button
      const addRow = document.createElement('div');
      addRow.className = 'add-prop-row';
      addRow.innerHTML = `
        <input type="text" placeholder="${isArr ? 'value' : 'key'}" class="add-key">
        <select class="add-type">
          ${VALUE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <button class="btn btn-sm">+ Add</button>
      `;
      addRow.querySelector('button').onclick = () => {
        const keyInput = addRow.querySelector('.add-key');
        const typeSelect = addRow.querySelector('.add-type');
        const newKey = isArr ? String(value.length) : keyInput.value.trim();
        if (!newKey) { toast('Key is required', 'error'); return; }
        const newType = typeSelect.value;
        const parent = Settings.getPath(fullPath);
        if (!isArr && parent.hasOwnProperty(newKey)) { toast('Key already exists', 'error'); return; }
        const defaultVal = Settings.defaultValue(newType);
        if (isArr) {
          parent.push(newType === 'string' ? keyInput.value : defaultVal);
        } else {
          parent[newKey] = defaultVal;
        }
        Settings.render();
      };
      children.appendChild(addRow);

      node.appendChild(children);
    }

    return node;
  },

  buildValueInput(value, type, fullPath) {
    if (type === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.onchange = () => Settings.setPath(fullPath, input.checked);
      return input;
    }
    if (type === 'number') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      input.onchange = () => {
        const num = Number(input.value);
        if (!isNaN(num)) Settings.setPath(fullPath, num);
      };
      return input;
    }
    if (type === 'null') {
      const span = document.createElement('span');
      span.style.color = 'var(--text-muted)';
      span.textContent = 'null';
      return span;
    }
    // string
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.onchange = () => Settings.setPath(fullPath, input.value);
    return input;
  },

  getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },

  defaultValue(type) {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      default: return null;
    }
  },

  getPath(pathArr) {
    let obj = Settings.data;
    for (const key of pathArr) obj = obj[key];
    return obj;
  },

  setPath(pathArr, value) {
    let obj = Settings.data;
    for (let i = 0; i < pathArr.length - 1; i++) obj = obj[pathArr[i]];
    obj[pathArr[pathArr.length - 1]] = value;
  },

  deletePath(pathArr) {
    let obj = Settings.data;
    for (let i = 0; i < pathArr.length - 1; i++) obj = obj[pathArr[i]];
    const key = pathArr[pathArr.length - 1];
    if (Array.isArray(obj)) {
      obj.splice(Number(key), 1);
    } else {
      delete obj[key];
    }
  },

  addRootProperty() {
    openModal({
      title: 'Add Root Property',
      body: formGroup('Key', '<input type="text" id="new-root-key" placeholder="propertyName">')
        + formGroup('Type', selectHtml('new-root-type', VALUE_TYPES, 'string')),
      buttons: [{
        label: 'Add', primary: true, onClick: () => {
          const key = document.getElementById('new-root-key').value.trim();
          const type = document.getElementById('new-root-type').value;
          if (!key) { toast('Key is required', 'error'); return false; }
          if (Settings.data.hasOwnProperty(key)) { toast('Key already exists', 'error'); return false; }
          Settings.data[key] = Settings.defaultValue(type);
          Settings.render();
        }
      }]
    });
  }
};
