const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const { banUser, unbanUser, softbanUser } = require('../../../../lib/moderation/engine');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user, permanently or for a set time')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450))
    .addStringOption(o => o.setName('duration').setDescription('Temporary ban length, e.g. 7d (empty = permanent)'))
    .addIntegerOption(o => o.setName('delete-days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7))
    .addBooleanOption(o => o.setName('silent').setDescription('Do not DM the user')),
  category: 'Moderation',
  usage: '/ban <user> [reason] [duration] [delete-days] [silent]',
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const length = readDuration(interaction);
    if (length.error) return fail(interaction, length.error);
    const user = interaction.options.getUser('user');
    const res = await banUser({
      guild: interaction.guild,
      moderator: interaction.member,
      userId: user.id,
      reason,
      minutes: length.minutes,
      deleteDays: interaction.options.getInteger('delete-days') ?? undefined,
      silent: interaction.options.getBoolean('silent') || false
    });
    if (!res.ok) return fail(interaction, res.error);
    return send(interaction, [caseLine(res, length.minutes ? `Banned for ${formatDuration(length.minutes)}:` : 'Banned')]);
  }
};
