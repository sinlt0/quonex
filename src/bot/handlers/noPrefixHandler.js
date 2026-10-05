const { canUseNoPrefix } = require('../../lib/permissions');
const { textCommands } = require('../../lib/textCommands');
const { runTextCommand } = require('../../lib/commandRunner');

async function handleNoPrefix(message) {
  if (message.author.bot || !message.guild) return;

  const allowed = await canUseNoPrefix(message.author.id, message.guild.id);
  if (!allowed) return;

  const [commandName, ...args] = message.content.trim().split(/\s+/);
  if (!commandName) return;

  const command = textCommands.get(commandName.toLowerCase());
  if (!command) return;

  await runTextCommand(command, message, args);
}

module.exports = { handleNoPrefix };
