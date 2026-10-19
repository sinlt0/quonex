const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'timeout',
  category: 'Moderation',
  description: 'Time a member out (max 28 days)',
  usage: 'timeout @user <duration> [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const length = kit.takeDuration(rest);
    if (!length.minutes) return kit.fail(message, `Give a duration like 10m, 2h or 1d. Usage: \`${this.usage}\``);
    const text = kit.reasonText(config, length.rest, message);
    if (text.stop) return;
    const res = await engine.timeoutUser({ guild: message.guild, moderator: message.member, userId: user.id, minutes: length.minutes, reason: text.reason });
    if (!res.ok) return kit.fail(message, res.error);
    return kit.reply(message, [`${em.on} Timed out **${res.user.tag}** for ${formatDuration(res.minutes)} · case #${res.row.caseNumber}`]);
  }
};
