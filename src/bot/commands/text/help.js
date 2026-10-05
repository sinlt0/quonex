const { isDev } = require('../../../lib/permissions');
const { collectCommands, findCommand, buildHomePayload, buildCommandPayload, buildNotFoundPayload, attachCollector } = require('../../../lib/help');

module.exports = {
  name: 'help',
  category: 'Info',
  description: 'Show the help menu',
  usage: 'help [command]',
  async execute(message, args) {
    const privileged = isDev(message.author.id);
    const categories = collectCommands(message.client, message.client.textCommands, privileged);
    const commandName = args[0];

    if (commandName) {
      const command = findCommand(categories, commandName);
      if (!command) {
        await message.reply(buildNotFoundPayload(commandName));
        return;
      }
      await message.reply(buildCommandPayload(command));
      return;
    }

    const sent = await message.reply(buildHomePayload(categories));
    attachCollector(sent, message.author.id, categories);
  }
};
