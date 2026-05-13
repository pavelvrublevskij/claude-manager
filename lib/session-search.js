const MAX_SNIPPETS = 3;
const SNIPPET_RADIUS = 75;

function extractEntrySnippets(entry, q, qLower, existing) {
  const content = entry.message?.content;
  const role = entry.type;
  const searchBlocks = [];

  if (typeof content === 'string') {
    searchBlocks.push({ text: content, label: '' });
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text') {
        searchBlocks.push({ text: block.text, label: '' });
      } else if (block.type === 'tool_use') {
        const inputStr = typeof block.input === 'string' ? block.input : JSON.stringify(block.input);
        searchBlocks.push({ text: inputStr, label: block.name || 'tool' });
      } else if (block.type === 'tool_result') {
        let resultText = '';
        if (typeof block.content === 'string') {
          resultText = block.content;
        } else if (Array.isArray(block.content)) {
          resultText = block.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        }
        if (resultText) searchBlocks.push({ text: resultText, label: 'result' });
      }
    }
  }

  const snippets = [];
  for (const sb of searchBlocks) {
    if (existing + snippets.length >= MAX_SNIPPETS) break;
    const idx = sb.text.toLowerCase().indexOf(qLower);
    if (idx === -1) continue;
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(sb.text.length, idx + q.length + SNIPPET_RADIUS);
    let snippet = (start > 0 ? '...' : '') + sb.text.slice(start, end) + (end < sb.text.length ? '...' : '');
    snippet = snippet.replace(/\n/g, ' ');
    snippets.push({ text: snippet, role, label: sb.label });
  }
  return snippets;
}

function extractMetaSnippet(fields, q, qLower) {
  for (const field of fields.filter(Boolean)) {
    if (!field.toLowerCase().includes(qLower)) continue;
    const idx = field.toLowerCase().indexOf(qLower);
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(field.length, idx + q.length + SNIPPET_RADIUS);
    return { text: field.slice(start, end), role: 'meta', label: '' };
  }
  return null;
}

module.exports = { MAX_SNIPPETS, extractEntrySnippets, extractMetaSnippet };
