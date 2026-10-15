const { SlashCommandBuilder } = require('discord.js');
const { getSettings, getLeaderboard } = require('../../../../lib/levels');
const { levelFromXp } = require('../../../../lib/xpCurve');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');
const { LEADERBOARD_PAGE_SIZE } = require('../../../../config/levels');

module.exports = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Show this server’s top members by XP'),
  category: 'Levels',
  usage: '/leaderboard',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply(v2Message([`${em.error} This only works in a server.`], { ephemeral: true }));
      return;
    }

    const settings = await getSettings(interaction.guild.id);
    if (!settings.enabled) {
      await interaction.reply(v2Message([`${em.error} Leveling isn't enabled on this server.`], { ephemeral: true }));
      return;
    }

    const top = await getLeaderboard(interaction.guild.id, LEADERBOARD_PAGE_SIZE);
    if (!top.length) {
      await interaction.reply(v2Message([`${em.arrow} No one has earned XP here yet.`]));
      return;
    }

    const lines = ['**Leaderboard**', SEPARATOR];
    top.forEach((entry, index) => {
      const { level } = levelFromXp(entry.xp);
      lines.push(`**${index + 1}.** <@${entry.userId}> — Level **${level}** (${entry.xp.toLocaleString()} XP)`);
    });

    await interaction.reply(v2Message(lines, { allowedMentions: { parse: [] } }));
  }
};
