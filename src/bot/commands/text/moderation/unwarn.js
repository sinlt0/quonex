const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'unwarn',
  category: 'Moderation',
  description: 'Remove a warning by case number, or clear all for a user',
  usage: 'unwarn <case number | @user>',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ModerateMembers);
    if (!config) return;
    if (/^\d{1,9}$/.test(args[0] || '')) {
      const number = Number(args[0]);
      const row = await cases.getCase(message.guild.id, number);
      if (!row || row.action !== 'warn') return kit.fail(message, 'That case is not a warning.');
      await cases.deactivateWarn(message.guild.id, number);
      return kit.reply(message, [`${em.on} Warning #${number} removed.`]);
    }
    const { user } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const count = await cases.clearWarns(message.guild.id, user.id);
    return kit.reply(message, [`${em.on} Cleared ${count} warning(s) for **${user.tag}**.`]);
  }
};
