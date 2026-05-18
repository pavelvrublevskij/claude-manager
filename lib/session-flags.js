const fs = require('fs');

const BRIDGE_MARKER = '"type":"bridge-session"';

function hasBridgeSession(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return text.includes(BRIDGE_MARKER);
  } catch (_) {
    return false;
  }
}

module.exports = { hasBridgeSession };
