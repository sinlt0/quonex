const { SlashCommandBuilder } = require('discord.js');
const { getSettings, buildRankReply } = require('../../../../lib/levels');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("Show your (or someone else's) level, XP, and leaderboard rank")
    .addUserOption(opt => opt.setName('user').setDescription('Whose rank to show (defaults to you)')),
  category: 'Levels',
  usage: '/rank [user]',
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

    const target = interaction.options.getUser('user') || interaction.user;
    await interaction.deferReply();
    await interaction.editReply(await buildRankReply({ guild: interaction.guild, user: target, settings }));
  }
};
