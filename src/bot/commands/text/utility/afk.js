const { setAfk, MAX_REASON_LENGTH } = require('../../../../lib/afk');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'afk',
  category: 'Utility',
  description: 'Mark yourself as AFK — anyone who @mentions you gets told, and it clears the next time you talk',
  usage: 'afk [reason]',
  async execute(message, args) {
    if (!message.guild) return;

    const reason = (args.join(' ').trim() || 'AFK').slice(0, MAX_REASON_LENGTH);
    await setAfk(message.guild.id, message.author.id, reason);

    await message.reply(
      v2Message([
        `${em.success} You're now marked as AFK: ${reason}`,
        `${em.arrow} I'll let anyone who @mentions you know, and clear this the next time you send a message.`
      ])
    );
  }
};
