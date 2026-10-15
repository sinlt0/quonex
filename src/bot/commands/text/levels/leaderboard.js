const { getSettings, getLeaderboard } = require('../../../../lib/levels');
const { levelFromXp } = require('../../../../lib/xpCurve');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');
const { LEADERBOARD_PAGE_SIZE } = require('../../../../config/levels');

module.exports = {
  name: 'leaderboard',
  category: 'Levels',
  description: "Show this server's top members by XP",
  usage: 'leaderboard',
  async execute(message) {
    if (!message.guild) return;

    const settings = await getSettings(message.guild.id);
    if (!settings.enabled) {
      await message.reply(v2Message([`${em.error} Leveling isn't enabled on this server.`]));
      return;
    }

    const top = await getLeaderboard(message.guild.id, LEADERBOARD_PAGE_SIZE);
    if (!top.length) {
      await message.reply(v2Message([`${em.arrow} No one has earned XP here yet.`]));
      return;
    }

    const lines = ['**Leaderboard**', SEPARATOR];
    top.forEach((entry, index) => {
      const { level } = levelFromXp(entry.xp);
      lines.push(`**${index + 1}.** <@${entry.userId}> — Level **${level}** (${entry.xp.toLocaleString()} XP)`);
    });

    await message.reply(v2Message(lines, { allowedMentions: { parse: [] } }));
  }
};
