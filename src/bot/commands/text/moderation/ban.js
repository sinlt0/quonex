const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'ban',
  category: 'Moderation',
  description: 'Ban a user, permanently or for a set time',
  usage: 'ban @user [duration] [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.BanMembers);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const length = kit.takeDuration(rest);
    const text = kit.reasonText(config, length.rest, message);
    if (text.stop) return;
    const res = await engine.banUser({ guild: message.guild, moderator: message.member, userId: user.id, reason: text.reason, minutes: length.minutes || null });
    if (!res.ok) return kit.fail(message, res.error);
    return kit.reply(message, [`${em.on} Banned${length.minutes ? ` for ${formatDuration(length.minutes)}` : ''} **${res.user.tag}** · case #${res.row.caseNumber}`]);
  }
};
