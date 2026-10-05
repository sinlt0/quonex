const { SlashCommandBuilder } = require('discord.js');
const { isDev } = require('../../../../lib/permissions');
const { collectCommands, findCommand, buildHomePayload, buildCommandPayload, buildNotFoundPayload, attachCollector } = require('../../../../lib/help');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show the help menu')
    .addStringOption(opt => opt.setName('command').setDescription('Get help for a specific command')),
  category: 'Info',
  usage: '/help [command]',
  async execute(interaction) {
    const privileged = isDev(interaction.user.id);
    const categories = collectCommands(interaction.client, interaction.client.textCommands, privileged);
    const commandName = interaction.options.getString('command');

    if (commandName) {
      const command = findCommand(categories, commandName);
      if (!command) {
        await interaction.reply({ ...buildNotFoundPayload(commandName), ephemeral: true });
        return;
      }
      await interaction.reply(buildCommandPayload(command));
      return;
    }

    await interaction.reply(buildHomePayload(categories));
    const sent = await interaction.fetchReply();
    attachCollector(sent, interaction.user.id, categories);
  }
};
