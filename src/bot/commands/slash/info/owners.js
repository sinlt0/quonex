const { SlashCommandBuilder } = require('discord.js');
const { listOwners } = require('../../../../lib/permissions');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { CREDIT } = require('../../../../config/branding');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owners')
    .setDescription('Show the Quonex bot owners'),
  category: 'Info',
  usage: '/owners',
  async execute(interaction) {
    const ids = listOwners();
    const lines = ids.map(id => `${em.premiumStar} <@${id}>`);

    await interaction.reply(v2Message(
      ['**Quonex Owners**', ...(lines.length ? lines : ['No owners listed.']), '', CREDIT, supportLine()],
      { allowedMentions: { users: [] } }
    ));
  }
};
