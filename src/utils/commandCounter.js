const path = require('path');
const { walkDir } = require('../lib/walkDir');

function extractSubcommands(jsonData) {
  if (!jsonData.options) return [];

  const subcommands = [];
  for (const option of jsonData.options) {
    if (option.type === 1) {
      subcommands.push({ name: option.name, description: option.description || '' });
    } else if (option.type === 2 && option.options) {
      for (const nested of option.options) {
        if (nested.type === 1) {
          subcommands.push({ name: `${option.name} ${nested.name}`, description: nested.description || '' });
        }
      }
    }
  }
  return subcommands;
}

function buildSlashManifest() {
  const dir = path.join(__dirname, '..', 'bot', 'commands', 'slash');
  return walkDir(dir).map(file => {
    const command = require(file);
    const jsonData = command.data.toJSON();

    return {
      type: 'slash',
      name: jsonData.name,
      description: jsonData.description,
      category: command.category || 'General',
      usage: command.usage || `/${jsonData.name}`,
      hidden: Boolean(command.hidden),
      subcommands: extractSubcommands(jsonData)
    };
  });
}

function buildTextManifest() {
  const dir = path.join(__dirname, '..', 'bot', 'commands', 'text');
  return walkDir(dir).map(file => {
    const command = require(file);

    return {
      type: 'prefix',
      name: command.name,
      description: command.description || '',
      category: command.category || 'General',
      usage: command.usage || command.name,
      hidden: Boolean(command.hidden),
      subcommands: []
    };
  });
}

function buildCommandManifest() {
  return [...buildSlashManifest(), ...buildTextManifest()];
}

module.exports = { buildCommandManifest };
