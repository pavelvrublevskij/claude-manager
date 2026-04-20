const fs = require('fs');

function getCustomTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let title = '';
    for (const line of lines) {
      if (!line.includes('"type":"custom-title"')) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'custom-title' && entry.customTitle) {
          title = entry.customTitle;
        }
      } catch (_) { /* malformed line */ }
    }
    return title;
  } catch (_) { return ''; }
}

module.exports = { getCustomTitle };
