const path = require('path');
const { walkDir } = require('../../lib/walkDir');

function loadCommands(client) {
  client.commands = new Map();
  const commandsDir = path.join(__dirname, '..', 'commands', 'slash');
  const files = walkDir(commandsDir);
  for (const file of files) {
    const command = require(file);
    client.commands.set(command.data.name, command);
  }
}

module.exports = { loadCommands, walk: walkDir };
