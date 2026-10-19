const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Time a member out (max 28 days)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('e.g. 10m, 2h, 1d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450)),
  category: 'Moderation',
  usage: '/timeout <user> <duration> [reason]',
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const length = readDuration(interaction);
    if (length.error || !length.minutes) return fail(interaction, length.error || 'Give a duration.');
    const res = await engine.timeoutUser({ guild: interaction.guild, moderator: interaction.member, userId: interaction.options.getUser('user').id, minutes: length.minutes, reason });
    if (!res.ok) return fail(interaction, res.error);
    return send(interaction, [caseLine(res, `Timed out for ${formatDuration(res.minutes)}:`)]);
  }
};
