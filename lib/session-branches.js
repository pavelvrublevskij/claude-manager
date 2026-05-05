const fs = require('fs');

/** Return an array of distinct gitBranch values seen on user messages in
 *  insertion order (the order each branch first appeared). */
function collectBranches(filePath) {
  const branches = [];
  const seen = new Set();
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'user') continue;
        const b = entry.gitBranch;
        if (!b || seen.has(b)) continue;
        seen.add(b);
        branches.push(b);
      } catch (_) { /* malformed line, skip */ }
    }
  } catch (_) { /* unreadable file */ }
  return branches;
}

module.exports = { collectBranches };
