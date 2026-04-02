const Settings = {
  data: {},
  showRaw: false,

  async load() {
    showLoading('settings-visual');
    try {
      const res = await api('/api/settings');
      Settings.data = JSON.parse(res.content);
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
