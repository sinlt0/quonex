const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'untimeout',
  category: 'Moderation',
  description: 'Remove a timeout',
  usage: 'untimeout @user [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const text = kit.reasonText(config, rest, message);
    if (text.stop) return;
    const res = await engine.untimeoutUser({ guild: message.guild, moderator: message.member, userId: user.id, reason: text.reason });
    if (!res.ok) return kit.fail(message, res.error);
    return kit.reply(message, [`${em.on} Timeout removed from **${res.user.tag}** · case #${res.row.caseNumber}`]);
  }
};
