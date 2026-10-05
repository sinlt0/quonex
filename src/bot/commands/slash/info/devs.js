const { SlashCommandBuilder } = require('discord.js');
const { listDevs } = require('../../../../lib/permissions');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { CREDIT } = require('../../../../config/branding');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devs')
    .setDescription('Show the Quonex bot developers'),
  category: 'Info',
  usage: '/devs',
  async execute(interaction) {
    const ids = listDevs();
    const lines = ids.map(id => `${em.arrow} <@${id}>`);

    await interaction.reply(v2Message(
      ['**Quonex Developers**', ...(lines.length ? lines : ['No developers listed.']), '', CREDIT, supportLine()],
      { allowedMentions: { users: [] } }
    ));
  }
};
