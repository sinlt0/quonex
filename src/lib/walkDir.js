const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walkDir(full));
    } else if (item.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

module.exports = { walkDir };
