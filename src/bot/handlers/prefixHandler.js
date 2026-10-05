const { getPrefix } = require('../../lib/prefix');
const { textCommands } = require('../../lib/textCommands');
const { runTextCommand } = require('../../lib/commandRunner');

async function handlePrefix(message) {
  if (message.author.bot || !message.guild) return false;

  const prefix = await getPrefix(message.guild.id);
  if (!message.content.startsWith(prefix)) return false;

  const withoutPrefix = message.content.slice(prefix.length).trim();
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  if (!commandName) return false;

  const command = textCommands.get(commandName.toLowerCase());
  if (!command) return false;

  await runTextCommand(command, message, args);
  return true;
}

module.exports = { handlePrefix };
