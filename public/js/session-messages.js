Object.assign(Sessions, {
  _detailSearchQuery: '',

  renderMessage(msg) {
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    let bodyHtml = '';
    const hasText = msg.content.some(b => b.type === 'text' && b.text && b.text.trim());

    for (const block of msg.content) {
      if (block.type === 'text') {
        bodyHtml += `<div class="chat-text">${renderMarkdown(block.text)}</div>`;
      } else if (block.type === 'tool_use') {
        const toolId = 'tool-' + Math.random().toString(36).slice(2, 8);
        const { headerSuffix, bodyContent } = Sessions.formatToolUse(block.name, block.input);
        bodyHtml += `
          <div class="chat-tool">
            <div class="chat-tool-header" onclick="document.getElementById('${toolId}').classList.toggle('open')">
              &#9654; <span class="tool-name">${escapeHtml(block.name)}</span>${headerSuffix}
            </div>
            <div class="chat-tool-body" id="${toolId}">${bodyContent}</div>
          </div>
        `;
      } else if (block.type === 'tool_result') {
        if (block.text) {
          const resId = 'res-' + Math.random().toString(36).slice(2, 8);
          bodyHtml += `
            <div class="chat-tool-result">
              <div class="chat-tool-header" onclick="document.getElementById('${resId}').classList.toggle('open')">
                &#9654; Result
              </div>
              <div class="chat-tool-body" id="${resId}">${escapeHtml(block.text)}</div>
            </div>
          `;
        }
      }
    }

    return `
      <div class="chat-msg ${msg.role}${hasText ? '' : ' chat-msg-tools-only'}">
        <div class="chat-role ${msg.role}">
          <span class="chat-role-label">${msg.role === 'user' ? 'You' : 'Claude'}</span>
          ${msg.model && msg.role === 'assistant' ? `<span class="chat-model">${escapeHtml(shortModel(msg.model))}</span>` : ''}
          <span class="chat-time">${time}</span>
        </div>
        ${bodyHtml}
      </div>
    `;
  },

  onDetailSearch: debounce(async function(value) {
    const q = value.trim();
    Sessions._detailSearchQuery = q;
    if (q.length >= 2) Sessions._saveToHistory(q, Sessions.DETAIL_SEARCH_HISTORY_KEY);
    if (q && Sessions.detailState.hasMore) {
      await Sessions.loadAllMessages();
      if (Sessions._detailSearchQuery !== q) return;
    }
    Sessions.applyDetailFilter(q);
  }, 500),

  async loadAllMessages() {
    while (Sessions.detailState.hasMore && !Sessions.detailState.loading) {
      await Sessions.loadMore();
    }
  },

  applyDetailFilter(query) {
    const container = document.getElementById('session-messages');
    const countEl = document.getElementById('session-detail-search-count');
    const messages = container.querySelectorAll('.chat-msg');
    const showTools = Sessions.showToolDetails();

    container.querySelectorAll('mark.search-highlight').forEach(m => {
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });

    if (!query) {
      messages.forEach(msg => msg.style.display = '');
      if (countEl) countEl.textContent = '';
      return;
    }

    const qLower = query.toLowerCase();
    let matchedMessages = 0;
    let totalMatches = 0;

    messages.forEach(msg => {
      if (!showTools && msg.classList.contains('chat-msg-tools-only')) {
        msg.style.display = '';
        return;
      }
      let text;
      if (showTools) {
        text = msg.textContent.toLowerCase();
      } else {
        text = Array.from(msg.querySelectorAll('.chat-text'))
          .map(n => n.textContent).join(' ').toLowerCase();
      }
      if (text.includes(qLower)) {
        msg.style.display = '';
        matchedMessages++;
        const scope = showTools ? msg : msg.querySelectorAll('.chat-text');
        if (showTools) {
          totalMatches += Sessions.highlightInNode(msg, query);
        } else {
          scope.forEach(n => { totalMatches += Sessions.highlightInNode(n, query); });
        }
      } else {
        msg.style.display = 'none';
      }
    });

    if (countEl) {
      countEl.textContent = matchedMessages
        ? `${totalMatches} matches in ${matchedMessages} messages`
        : 'No matches';
    }
  },

  highlightInNode(root, query) {
    const qLower = query.toLowerCase();
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentNode.tagName === 'SCRIPT' || n.parentNode.tagName === 'STYLE'
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      let idx = lower.indexOf(qLower);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        count++;
        last = idx + query.length;
        idx = lower.indexOf(qLower, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
    return count;
  },

  formatToolUse(name, input) {
    const basename = p => p ? escapeHtml(p.split(/[/\\]/).pop()) : '';
    const param = html => `<span class="tool-param">${html}</span>`;

    switch (name) {
      case 'Edit': {
        const file = basename(input.file_path || '');
        return {
          headerSuffix: file ? ` ${param(file)}` : '',
          bodyContent: Sessions.renderEditDiff(input)
        };
      }
      case 'Write': {
        const file = basename(input.file_path || '');
        const preview = (input.content || '').slice(0, 600);
        return {
          headerSuffix: file ? ` ${param(file)}` : '',
          bodyContent: `<div class="tool-file-path">${escapeHtml(input.file_path || '')}</div><pre class="tool-code">${escapeHtml(preview)}${(input.content || '').length > 600 ? '\n…' : ''}</pre>`
        };
      }
      case 'Read': {
        const file = basename(input.file_path || '');
        const extras = [input.offset ? `offset:${input.offset}` : '', input.limit ? `limit:${input.limit}` : ''].filter(Boolean).join('  ');
        return {
          headerSuffix: file ? ` ${param(file)}${extras ? ` <span class="tool-param-muted">${escapeHtml(extras)}</span>` : ''}` : '',
          bodyContent: `<div class="tool-file-path">${escapeHtml(input.file_path || '')}</div>`
        };
      }
      case 'Bash': {
        const cmd = input.command || '';
        const preview = cmd.slice(0, 80) + (cmd.length > 80 ? '…' : '');
        return {
          headerSuffix: cmd ? ` ${param(escapeHtml(preview))}` : '',
          bodyContent: `<pre class="tool-code">${escapeHtml(cmd)}</pre>`
        };
      }
      case 'Glob':
        return {
          headerSuffix: input.pattern ? ` ${param(escapeHtml(input.pattern))}` : '',
          bodyContent: escapeHtml(JSON.stringify(input, null, 2))
        };
      case 'Grep':
        return {
          headerSuffix: input.pattern ? ` ${param(escapeHtml(input.pattern))}` : '',
          bodyContent: escapeHtml(JSON.stringify(input, null, 2))
        };
      case 'Agent': {
        const desc = input.description ? input.description.slice(0, 60) : '';
        return {
          headerSuffix: desc ? ` ${param(escapeHtml(desc))}` : '',
          bodyContent: escapeHtml(JSON.stringify(input, null, 2))
        };
      }
      case 'WebFetch': {
        let host = '';
        try { host = new URL(input.url || '').hostname; } catch (_) { host = (input.url || '').slice(0, 60); }
        return {
          headerSuffix: host ? ` ${param(escapeHtml(host))}` : '',
          bodyContent: escapeHtml(JSON.stringify(input, null, 2))
        };
      }
      case 'WebSearch':
        return {
          headerSuffix: input.query ? ` ${param(escapeHtml(input.query.slice(0, 60)))}` : '',
          bodyContent: escapeHtml(JSON.stringify(input, null, 2))
        };
      default:
        return { headerSuffix: '', bodyContent: escapeHtml(JSON.stringify(input, null, 2)) };
    }
  },

  renderEditDiff(input) {
    const filePath = input.file_path ? `<div class="tool-file-path">${escapeHtml(input.file_path)}</div>` : '';
    const replaceAll = input.replace_all ? `<div class="tool-replace-all">replace_all</div>` : '';
    const oldStr = input.old_string != null ? `
      <div class="tool-diff-section tool-diff-old">
        <div class="tool-diff-label">Before</div>
        <pre>${escapeHtml(input.old_string.trim())}</pre>
      </div>` : '';
    const newStr = input.new_string != null ? `
      <div class="tool-diff-section tool-diff-new">
        <div class="tool-diff-label">After</div>
        <pre>${escapeHtml(input.new_string.trim())}</pre>
      </div>` : '';
    return `${filePath}${replaceAll}<div class="tool-diff">${oldStr}${newStr}</div>`;
  }
});
