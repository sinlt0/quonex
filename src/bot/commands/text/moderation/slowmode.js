const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'slowmode',
  category: 'Moderation',
  description: 'Set slowmode in this channel',
  usage: 'slowmode <seconds>',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ManageChannels);
    if (!config) return;
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) return kit.fail(message, `Give 0 to 21600 seconds. Usage: \`${this.usage}\``);
    try {
      await message.channel.setRateLimitPerUser(seconds, `Slowmode by ${message.author.tag}`);
    } catch {
      return kit.fail(message, 'I could not change slowmode here.');
    }
    return kit.reply(message, [seconds ? `${em.on} Slowmode set to **${seconds}s**.` : `${em.on} Slowmode removed.`]);
  }
};
