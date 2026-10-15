const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../../lib/db');
const { publishInteractiveMessage } = require('../../../../lib/interactive');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');
const { INTERACTIVE_ERROR_MESSAGES } = require('../../../../config/interactive');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Post or list the button and menu messages built on the dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('list').setDescription('List your interactive messages'))
    .addSubcommand(sub =>
      sub
        .setName('send')
        .setDescription('Post an interactive message to a channel')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the message, as shown on the dashboard').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Where to post it (defaults to here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),
  category: 'Roles',
  usage: '/rolemenu <list|send>',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply(v2Message([`${em.error} This only works in a server.`], { ephemeral: true }));
      return;
    }

    const rows = await prisma.interactiveMessage.findMany({ where: { guildId: interaction.guild.id }, orderBy: { createdAt: 'asc' } });
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      if (!rows.length) {
        await interaction.reply(v2Message(['No interactive messages yet. Build one on the dashboard under **Roles & Buttons**.'], { ephemeral: true }));
        return;
      }
      const lines = rows.map(row => `• **${row.name}** — ${row.channelId ? `live in <#${row.channelId}>` : 'draft'}`);
      await interaction.reply(v2Message(['**Interactive messages**', ...lines], { ephemeral: true, allowedMentions: { parse: [] } }));
      return;
    }

    const name = interaction.options.getString('name').trim().toLowerCase();
    const row = rows.find(item => item.name.toLowerCase() === name);
    if (!row) {
      await interaction.reply(v2Message([`${em.error} No message named **${name}**. Use /rolemenu list.`], { ephemeral: true }));
      return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await interaction.deferReply({ ephemeral: true });
    const result = await publishInteractiveMessage(interaction.client, { guildId: interaction.guild.id, id: row.id, channelId: channel.id });
    if (!result.ok) {
      await interaction.editReply(v2Message([`${em.error} ${INTERACTIVE_ERROR_MESSAGES[result.error] || 'Could not post that message.'}`]));
      return;
    }
    await interaction.editReply(v2Message([`${em.success || '✅'} Posted **${row.name}** in <#${channel.id}>.`]));
  }
};
