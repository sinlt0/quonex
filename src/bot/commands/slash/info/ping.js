const { SlashCommandBuilder } = require('discord.js');
const { em } = require('../../../../lib/emojis');
const { v2Message } = require('../../../../lib/components');
const { formatUptime } = require('../../../../lib/uptime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Show bot latency and uptime'),
  category: 'Info',
  usage: '/ping',
  async execute(interaction) {
    const uptime = formatUptime(interaction.client.uptime || 0);
    await interaction.reply(v2Message([
      `${em.success} Pong! \`${interaction.client.ws.ping}ms\``,
      `${em.arrow} Uptime: \`${uptime}\``
    ]));
  }
};
