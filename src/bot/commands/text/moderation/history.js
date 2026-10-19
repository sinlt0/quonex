const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'history',
  category: 'Moderation',
  description: 'Moderation history for a user',
  usage: 'history @user',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const { user } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const [rows, total] = await cases.listCases(message.guild.id, { userId: user.id, take: 8 });
    if (!total) return kit.reply(message, [`${em.on} **${user.tag}** has a clean record.`]);
    const lines = [`### ${em.modCase} ${user.tag} · ${total} case${total === 1 ? '' : 's'}`];
    for (const row of rows) lines.push(`**#${row.caseNumber}** ${engine.LABELS[row.action] || row.action} · <t:${Math.floor(row.createdAt.getTime() / 1000)}:d> · ${row.reason || '*no reason*'}`);
    return kit.reply(message, lines);
  }
};
