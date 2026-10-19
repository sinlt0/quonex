const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'case',
  category: 'Moderation',
  description: 'Show a moderation case',
  usage: 'case <number>',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const number = Number(args[0]);
    if (!Number.isInteger(number) || number < 1) return kit.fail(message, `Usage: \`${this.usage}\``);
    const row = await cases.getCase(message.guild.id, number);
    if (!row) return kit.fail(message, 'Case not found.');
    const label = engine.LABELS[row.action] || row.action;
    const length = row.duration ? ` (${formatDuration(row.duration)})` : '';
    return kit.reply(message, [
      `**#${row.caseNumber}** ${engine.ICONS[row.action] || em.modCase} ${label}${length}${row.auto ? ' · auto' : ''}`,
      `User: <@${row.userId}> (\`${row.userId}\`)`,
      `Moderator: <@${row.moderatorId}>`,
      `<t:${Math.floor(row.createdAt.getTime() / 1000)}:F>`,
      `> ${row.reason || '*no reason*'}`
    ]);
  }
};
