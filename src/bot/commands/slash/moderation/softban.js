const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const { banUser, unbanUser, softbanUser } = require('../../../../lib/moderation/engine');


const softban = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban to wipe recent messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450))
    .addIntegerOption(o => o.setName('delete-days').setDescription('Days of messages to delete (default 1)').setMinValue(1).setMaxValue(7)),
  category: 'Moderation',
  usage: '/softban <user> [reason] [delete-days]',
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const res = await softbanUser({
      guild: interaction.guild,
      moderator: interaction.member,
      userId: interaction.options.getUser('user').id,
      reason,
      deleteDays: interaction.options.getInteger('delete-days') || 1
    });
    if (!res.ok) return fail(interaction, res.error);
    return send(interaction, [caseLine(res, 'Softbanned')]);
  }
};

module.exports = softban;
