const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { begin, fail, send } = require('../../../../lib/moderation/common');
const store = require('../../../../lib/security/store');
const { securityLog } = require('../../../../lib/security/alerts');
const engine = require('../../../../lib/moderation/engine');
const prisma = require('../../../../lib/db');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addIntegerOption(o => o.setName('seconds').setDescription('0 turns it off').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread)),
  category: 'Moderation',
  usage: '/slowmode <seconds> [channel]',
  async execute(interaction) {
    await begin(interaction);
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const seconds = interaction.options.getInteger('seconds');
    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
    } catch {
      return fail(interaction, 'I could not change slowmode there.');
    }
    return send(interaction, [seconds ? `${em.on} Slowmode in <#${channel.id}> set to **${seconds}s**.` : `${em.on} Slowmode removed in <#${channel.id}>.`]);
  }
};
