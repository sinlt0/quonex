const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'warnings',
  category: 'Moderation',
  description: "Show a member's active warnings",
  usage: 'warnings @user',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const { user } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const rows = await cases.activeWarns(message.guild.id, user.id);
    if (!rows.length) return kit.reply(message, [`${em.on} **${user.tag}** has no active warnings.`]);
    const lines = [`### ${em.modWarn} Warnings for ${user.tag} (${rows.length})`];
    for (const row of rows.slice(0, 15)) lines.push(`**#${row.caseNumber}** <t:${Math.floor(row.createdAt.getTime() / 1000)}:R> by <@${row.moderatorId}> · ${row.reason}`);
    return kit.reply(message, lines);
  }
};
