const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { gatherStats, statsLines } = require('../../../../lib/moderation/insights');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('Moderation activity for the server or one moderator')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addIntegerOption(o => o.setName('days').setDescription('Days to look back (default 7)').setMinValue(1).setMaxValue(365))
    .addUserOption(o => o.setName('moderator').setDescription('Only this moderator')),
  category: 'Moderation',
  usage: '/modstats [days] [moderator]',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const days = interaction.options.getInteger('days') || 7;
    const moderator = interaction.options.getUser('moderator');
    const stats = await gatherStats(interaction.guild.id, days, moderator && moderator.id);
    const title = moderator ? `Moderation stats for ${moderator.tag}` : 'Moderation stats';
    return interaction.editReply(v2Message(statsLines(stats, days, title), { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
  }
};
