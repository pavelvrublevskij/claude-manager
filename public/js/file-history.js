// --- File History diff rendering ---

const FileHistory = {
  async showDiffCurrent(sessionId, hash, version, projSlug, filePath, opts = {}) {
    const isNew = !!opts.isNew;
    const isDeleted = !!opts.isDeleted;
    const label = isNew ? '(new file)' : isDeleted ? '(deleted)' : `v${version} → current`;
    const overlay = openModal({
      title: `Diff: ${filePath} ${label}`,
      width: 860,
      body: '<div id="fh-diff-body"><div class="loading"><div class="spinner"></div>Computing diff…</div></div>',
      buttons: []
    });
    try {
      const params = new URLSearchParams({ projSlug, filePath });
      if (isNew) { params.set('isNew', 'true'); }
      else { params.set('version', String(version)); }
      const hashSeg = isNew ? 'none' : encodeURIComponent(hash);
      const result = await api(`/api/file-history/${encodeURIComponent(sessionId)}/${hashSeg}/diff-current?${params.toString()}`);
      FileHistory.renderDiff(overlay.querySelector('#fh-diff-body'), result, filePath);
    } catch (e) {
      overlay.querySelector('#fh-diff-body').innerHTML =
        `<div class="empty-state"><p>Could not load diff: ${escapeHtml(e.message)}</p></div>`;
    }
  },

  renderDiff(container, result, filePath) {
    if (result.tooLarge) { container.innerHTML = '<div class="empty-state"><p>File too large to diff (&gt;5000 lines)</p></div>'; return; }
    if (!result.hunks.length) { container.innerHTML = '<div class="empty-state"><p>No differences found</p></div>'; return; }

    const stats = `<div class="diff-stats">
      <span class="diff-added">+${result.stats.added} added</span>
      <span class="diff-removed">-${result.stats.removed} removed</span>
    </div>`;

    const hunks = result.hunks.map(hunk =>
      `<div class="diff-hunk-header">@@ -${hunk.oldStart} +${hunk.newStart} @@</div>`
      + hunk.lines.map(l => {
          const cls = l.type === '+' ? 'diff-line-add' : l.type === '-' ? 'diff-line-del' : 'diff-line-ctx';
          const prefix = l.type === '+' ? '+' : l.type === '-' ? '-' : ' ';
          return `<div class="diff-line ${cls}"><span class="diff-prefix">${prefix}</span><span class="diff-content">${escapeHtml(l.content)}</span></div>`;
        }).join('')
    ).join('<div class="diff-separator"></div>');

    const diffHtml = stats + `<div class="diff-view">${hunks}</div>`;

    const isMd = filePath && filePath.toLowerCase().endsWith('.md') && result.currentText;
    if (!isMd) {
      container.innerHTML = diffHtml;
      return;
    }

    container.innerHTML = `
      <div class="md-view-toggle">
        <button class="md-toggle-btn active" onclick="FileHistory._showMdPane('preview')">Preview</button>
        <button class="md-toggle-btn" onclick="FileHistory._showMdPane('diff')">Diff</button>
      </div>
      <div id="fh-md-preview" class="md-preview-pane markdown-body">${renderMarkdown(result.currentText)}</div>
      <div id="fh-diff-pane" style="display:none">${diffHtml}</div>
    `;
  },

  _showMdPane(which) {
    const preview = document.getElementById('fh-md-preview');
    const diff = document.getElementById('fh-diff-pane');
    const btns = preview.closest('#fh-diff-body').querySelectorAll('.md-toggle-btn');
    const isPreview = which === 'preview';
    preview.style.display = isPreview ? '' : 'none';
    diff.style.display = isPreview ? 'none' : '';
    btns.forEach((b, i) => b.classList.toggle('active', isPreview ? i === 0 : i === 1));
  }
};
