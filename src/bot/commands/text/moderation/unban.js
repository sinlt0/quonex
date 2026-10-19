const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'unban',
  category: 'Moderation',
  description: 'Unban a user by ID',
  usage: 'unban <userId> [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.BanMembers);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const text = kit.reasonText(config, rest, message);
    if (text.stop) return;
    const res = await engine.unbanUser({ guild: message.guild, moderator: message.member, userId: user.id, reason: text.reason });
    if (!res.ok) return kit.fail(message, res.error);
    return kit.reply(message, [`${em.on} Unbanned **${res.user.tag}** · case #${res.row.caseNumber}`]);
  }
};
