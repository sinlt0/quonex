const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { begin, fail, send } = require('../../../../lib/moderation/common');
const store = require('../../../../lib/security/store');
const { securityLog } = require('../../../../lib/security/alerts');
const engine = require('../../../../lib/moderation/engine');
const { runPurge } = require('../../../../lib/moderation/purge');
const prisma = require('../../../../lib/db');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

const DESCRIPTIONS = {
  all: 'Delete recent messages',
  bots: 'Delete messages from bots',
  humans: 'Delete messages from humans',
  links: 'Delete messages containing links',
  invites: 'Delete messages containing invites',
  attachments: 'Delete messages with attachments',
  embeds: 'Delete messages with embeds'
};

function amountOption(o) {
  return o.setName('amount').setDescription('How many messages to scan').setRequired(true).setMinValue(1).setMaxValue(1000);
}

function build() {
  const builder = new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false);
  for (const [name, text] of Object.entries(DESCRIPTIONS)) builder.addSubcommand(s => s.setName(name).setDescription(text).addIntegerOption(amountOption));
  builder.addSubcommand(s => s.setName('user').setDescription('Delete messages from one user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(amountOption));
  builder.addSubcommand(s => s.setName('contains').setDescription('Delete messages containing text').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true).setMaxLength(100)).addIntegerOption(amountOption));
  return builder;
}

module.exports = {
  data: build(),
  category: 'Moderation',
  usage: '/purge <all|user|bots|humans|links|invites|attachments|embeds|contains> <amount>',
  async execute(interaction) {
    const config = await begin(interaction);
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const result = await runPurge({
      guild: interaction.guild,
      channel: interaction.channel,
      moderatorId: interaction.user.id,
      config,
      sub,
      amount: interaction.options.getInteger('amount'),
      userId: user && user.id,
      text: interaction.options.getString('text')
    });
    if (result.error) return fail(interaction, result.error);
    const deleted = result.deleted;
    return send(interaction, [deleted ? `${em.on} Deleted **${deleted}** message${deleted === 1 ? '' : 's'}.` : 'Nothing matched. Messages older than 14 days cannot be bulk deleted.']);
  }
};
