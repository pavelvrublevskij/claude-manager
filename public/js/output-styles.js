const OutputStyles = makeFrontmatterCrud({
  globalName: 'OutputStyles',
  containerId: 'output-styles-content',
  apiBase: '/api/output-styles/global',
  itemKey: 'filename',
  idPrefix: 'os',
  itemLabel: 'Output Style',
  cardTitle: s => escapeHtml(s.name),
  editFromList: true,
  editTitle: (item, filename) => item.frontmatter.name || filename,
  infoNote: `Output styles control how Claude formats responses. Built-in styles: <strong>Default</strong>, <strong>Explanatory</strong>, <strong>Learning</strong>.
    Create custom styles with YAML frontmatter (name, description) and markdown instructions.
    Set active style in settings via <code>outputStyle</code> field, or use the picker in Claude Code.
    Stored in <code>~/.claude/output-styles/</code> (global) or <code>.claude/output-styles/</code> (per-project).`,
  emptyText: 'No custom output styles',
  createFields: idp =>
    formGroup('Filename', `<input type="text" id="${idp}-new-file" placeholder="my-style.md">`)
    + formGroup('Name', `<input type="text" id="${idp}-new-name" placeholder="My Style">`),
  createBody: idp => {
    let filename = document.getElementById(`${idp}-new-file`).value.trim();
    const name = document.getElementById(`${idp}-new-name`).value.trim();
    if (!filename) { toast('Filename required', 'error'); return null; }
    if (!filename.endsWith('.md')) filename += '.md';
    return { key: filename, frontmatter: { name, description: '' }, content: '' };
  }
});
