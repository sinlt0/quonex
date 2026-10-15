const { getSettings, buildRankReply } = require('../../../../lib/levels');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  name: 'rank',
  category: 'Levels',
  description: "Show your (or someone else's) level, XP, and leaderboard rank",
  usage: 'rank [@user]',
  async execute(message) {
    if (!message.guild) return;

    const settings = await getSettings(message.guild.id);
    if (!settings.enabled) {
      await message.reply(v2Message([`${em.error} Leveling isn't enabled on this server.`]));
      return;
    }

    const target = message.mentions.users.first() || message.author;
    await message.reply(await buildRankReply({ guild: message.guild, user: target, settings }));
  }
};
