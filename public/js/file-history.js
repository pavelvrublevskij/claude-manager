// --- File History diff rendering ---

const FileHistory = {
  showDiffFromBtn(btn) {
    const { session, hash, from, to, path } = btn.dataset;
    FileHistory.showDiff(session, hash, parseInt(from, 10), parseInt(to, 10), path);
  },

  async showDiff(sessionId, hash, from, to, filePath) {
    const overlay = openModal({
      title: `Diff: ${filePath} v${from} → v${to}`,
      width: 860,
      body: '<div id="fh-diff-body"><div class="loading"><div class="spinner"></div>Computing diff…</div></div>',
      buttons: []
    });
    try {
      const result = await api(`/api/file-history/${encodeURIComponent(sessionId)}/${encodeURIComponent(hash)}/diff?from=${from}&to=${to}`);
      FileHistory.renderDiff(overlay.querySelector('#fh-diff-body'), result);
    } catch (e) {
      overlay.querySelector('#fh-diff-body').innerHTML =
        `<div class="empty-state"><p>Could not load diff: ${escapeHtml(e.message)}</p></div>`;
    }
  },

  renderDiff(container, result) {
    if (result.tooLarge) { container.innerHTML = '<div class="empty-state"><p>File too large to diff (&gt;3000 lines)</p></div>'; return; }
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

    container.innerHTML = stats + `<div class="diff-view">${hunks}</div>`;
  }
};
