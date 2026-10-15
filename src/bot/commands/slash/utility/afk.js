const { SlashCommandBuilder } = require('discord.js');
const { setAfk, MAX_REASON_LENGTH } = require('../../../../lib/afk');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Mark yourself as AFK — anyone who @mentions you gets told, and it clears the next time you talk')
    .addStringOption(opt => opt.setName('reason').setDescription('AFK reason (optional)').setMaxLength(MAX_REASON_LENGTH)),
  category: 'Utility',
  usage: '/afk [reason]',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply(v2Message([`${em.error} This only works in a server.`], { ephemeral: true }));
      return;
    }

    const reason = interaction.options.getString('reason') || 'AFK';
    await setAfk(interaction.guild.id, interaction.user.id, reason);

    await interaction.reply(
      v2Message(
        [
          `${em.success} You're now marked as AFK: ${reason}`,
          `${em.arrow} I'll let anyone who @mentions you know, and clear this the next time you send a message.`
        ],
        { ephemeral: true }
      )
    );
  }
};
