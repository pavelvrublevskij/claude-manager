// --- Modal Factory ---

/**
 * Open a modal dialog.
 * @param {Object} opts
 * @param {string} opts.title - Modal title
 * @param {number} [opts.width] - Modal width in px
 * @param {string} opts.body - HTML string for the modal body
 * @param {Array} opts.buttons - Array of { label, primary?, danger?, onClick }
 * @returns {HTMLElement} The overlay element (for external removal if needed)
 */
function openModal({ title, width, body, buttons = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  if (width) modal.style.width = width + 'px';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  modal.appendChild(h3);

  const content = document.createElement('div');
  content.innerHTML = body;
  modal.appendChild(content);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => overlay.remove();
  btnGroup.appendChild(cancelBtn);

  for (const { label, primary, danger, onClick } of buttons) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (primary ? ' btn-primary' : '') + (danger ? ' btn-danger' : '');
    btn.textContent = label;
    btn.onclick = async () => {
      const result = await onClick();
      if (result !== false) overlay.remove();
    };
    btnGroup.appendChild(btn);
  }

  modal.appendChild(btnGroup);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  return overlay;
}

/** Helper: create a form group with label + input HTML. */
function formGroup(label, inputHtml) {
  return `<div class="form-group"><label>${escapeHtml(label)}</label>${inputHtml}</div>`;
}

/** Helper: wrap form groups in a row. */
function formRow(...groups) {
  return `<div class="form-row">${groups.join('')}</div>`;
}

/** Helper: create a <select> element HTML from an array of options. */
function selectHtml(id, options, selected) {
  return `<select id="${id}">${options.map(o =>
    `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`
  ).join('')}</select>`;
}
