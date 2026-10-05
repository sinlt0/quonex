import manifest from '../../content/commands.json';

export function getAllCommands() {
  return manifest;
}

export function getPublicCommands() {
  return manifest.filter(command => !command.hidden);
}

export function getPublicCommandsByCategory() {
  const commands = getPublicCommands();
  const categories = new Map();

  for (const command of commands) {
    if (!categories.has(command.category)) categories.set(command.category, []);
    categories.get(command.category).push(command);
  }

  return categories;
}
