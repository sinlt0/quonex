const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'warn',
  category: 'Moderation',
  description: 'Warn a member',
  usage: 'warn @user [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const text = kit.reasonText(config, rest, message);
    if (text.stop) return;
    const res = await engine.warnUser({ guild: message.guild, moderator: message.member, userId: user.id, reason: text.reason });
    if (!res.ok) return kit.fail(message, res.error);
    const lines = [`${em.on} Warned **${res.user.tag}** · case #${res.row.caseNumber} · ${res.count} active warning${res.count === 1 ? '' : 's'}`];
    if (res.escalation && res.escalation.ok) lines.push(`${em.alert} Automatic escalation applied: case #${res.escalation.row.caseNumber} (${res.escalation.row.action})`);
    return kit.reply(message, lines);
  }
};
