const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'nick',
  category: 'Moderation',
  description: 'Change or reset a member nickname',
  usage: 'nick @user [nickname]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ManageNicknames);
    if (!config) return;
    const { user, rest } = await kit.needUser(message, args, this.usage);
    if (!user) return;
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return kit.fail(message, 'That member is not in the server.');
    if (member.id !== message.author.id) {
      const blocked = await engine.checkTarget({ guild: message.guild, config, moderator: message.member, user, member, action: 'rename' });
      if (blocked) return kit.fail(message, blocked);
    }
    const nickname = rest.join(' ').slice(0, 32) || null;
    try {
      await member.setNickname(nickname, `Nick by ${message.author.tag}`);
    } catch {
      return kit.fail(message, 'I could not change that nickname.');
    }
    return kit.reply(message, [`${em.on} Nickname updated for **${user.tag}**.`]);
  }
};
