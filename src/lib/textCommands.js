const fs = require('fs');
const path = require('path');
const { walkDir } = require('./walkDir');

function loadTextCommands() {
  const dir = path.join(__dirname, '..', 'bot', 'commands', 'text');
  const store = new Map();
  if (!fs.existsSync(dir)) return store;
  for (const file of walkDir(dir)) {
    const command = require(file);
    store.set(command.name, command);
  }
  return store;
}

const textCommands = loadTextCommands();

module.exports = { textCommands };
