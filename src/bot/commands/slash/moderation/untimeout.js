const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450)),
  category: 'Moderation',
  usage: '/untimeout <user> [reason]',
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const res = await engine.untimeoutUser({ guild: interaction.guild, moderator: interaction.member, userId: interaction.options.getUser('user').id, reason });
    if (!res.ok) return fail(interaction, res.error);
    return send(interaction, [caseLine(res, 'Timeout removed from')]);
  }
};
