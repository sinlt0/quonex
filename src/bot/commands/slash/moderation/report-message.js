const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { loadConfig } = require('../../../../lib/security/store');
const { reportModal } = require('../../../../lib/moderation/reports');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Report message').setType(ApplicationCommandType.Message).setDMPermission(false),
  category: 'Moderation',
  usage: 'Right click a message, Apps, Report message',
  hidden: true,
  async execute(interaction) {
    const config = (await loadConfig(interaction.guild.id)).moderation;
    if (!config.reportsEnabled) return interaction.reply(v2Message([`${em.alert} Reports are turned off on this server.`], { ephemeral: true, footer: false }));
    const message = interaction.targetMessage;
    if (message.author.bot) return interaction.reply(v2Message([`${em.alert} Bot messages cannot be reported.`], { ephemeral: true, footer: false }));
    if (message.author.id === interaction.user.id) return interaction.reply(v2Message([`${em.alert} You cannot report your own message.`], { ephemeral: true, footer: false }));
    return interaction.showModal(reportModal(message.channelId, message.id));
  }
};
