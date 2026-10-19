const { SlashCommandBuilder } = require('discord.js');
const { loadConfig } = require('../../../../lib/security/store');
const { reportModal } = require('../../../../lib/moderation/reports');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a message to the moderators')
    .setDMPermission(false)
    .addStringOption(o => o.setName('message').setDescription('Message link (right click a message, Copy Message Link)').setRequired(true)),
  category: 'Moderation',
  usage: '/report <message link>',
  async execute(interaction) {
    const fail = text => interaction.reply(v2Message([`${em.alert} ${text}`], { ephemeral: true, footer: false }));
    const config = (await loadConfig(interaction.guild.id)).moderation;
    if (!config.reportsEnabled) return fail('Reports are turned off on this server.');
    const match = interaction.options.getString('message').match(/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (!match || match[1] !== interaction.guild.id) return fail('Paste a message link from this server.');
    return interaction.showModal(reportModal(match[2], match[3]));
  }
};
