const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450)),
  category: 'Moderation',
  usage: '/warn <user> [reason]',
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const res = await engine.warnUser({ guild: interaction.guild, moderator: interaction.member, userId: interaction.options.getUser('user').id, reason });
    if (!res.ok) return fail(interaction, res.error);
    const lines = [`${caseLine(res, 'Warned')} · ${res.count} active warning${res.count === 1 ? '' : 's'}`];
    if (res.escalation && res.escalation.ok) lines.push(`${em.alert} Automatic escalation applied: case #${res.escalation.row.caseNumber} (${res.escalation.row.action})`);
    return send(interaction, lines);
  }
};
