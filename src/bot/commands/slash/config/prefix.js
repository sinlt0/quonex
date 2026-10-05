const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getPrefix, setPrefix, resetPrefix } = require('../../../../lib/prefix');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Manage the command prefix for this server')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set a custom prefix')
        .addStringOption(opt => opt.setName('prefix').setDescription('New prefix').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset the prefix to default'))
    .addSubcommand(sub => sub.setName('view').setDescription('View the current prefix')),
  category: 'Config',
  usage: '/prefix <set|reset|view>',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const prefix = await getPrefix(interaction.guild.id);
      await interaction.reply(v2Message([`${em.arrow} Current prefix: \`${prefix}\``], { ephemeral: true }));
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply(v2Message([`${em.error} You need the Manage Server permission to change the prefix.`, supportLine()], { ephemeral: true }));
      return;
    }

    if (sub === 'set') {
      const newPrefix = interaction.options.getString('prefix');
      if (newPrefix.length > 5) {
        await interaction.reply(v2Message([`${em.error} Prefix must be 5 characters or fewer.`], { ephemeral: true }));
        return;
      }
      await setPrefix(interaction.guild.id, newPrefix);
      await interaction.reply(v2Message([`${em.success} Prefix set to \`${newPrefix}\``]));
    } else if (sub === 'reset') {
      await resetPrefix(interaction.guild.id);
      await interaction.reply(v2Message([`${em.success} Prefix reset to default.`]));
    }
  }
};
