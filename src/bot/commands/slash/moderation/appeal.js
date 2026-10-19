const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../../lib/db');
const { renderAppeal } = require('../../../../lib/moderation/appeals');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Review ban appeals')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addSubcommand(s =>
      s
        .setName('list')
        .setDescription('Show appeals')
        .addStringOption(o => o.setName('status').setDescription('Filter').addChoices({ name: 'Pending', value: 'pending' }, { name: 'Approved', value: 'approved' }, { name: 'Denied', value: 'denied' }))
    )
    .addSubcommand(s => s.setName('view').setDescription('Show one appeal').addIntegerOption(o => o.setName('number').setDescription('Appeal number').setRequired(true).setMinValue(1))),
  category: 'Moderation',
  usage: '/appeal <list|view>',
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const appeal = await prisma.modAppeal.findUnique({ where: { guildId_number: { guildId, number: interaction.options.getInteger('number') } } });
      if (!appeal) return interaction.reply(v2Message([`${em.alert} Appeal not found.`], { ephemeral: true, footer: false }));
      const caseRow = appeal.caseNumber ? await prisma.modCase.findUnique({ where: { guildId_caseNumber: { guildId, caseNumber: appeal.caseNumber } } }) : null;
      const payload = renderAppeal(appeal, caseRow);
      payload.flags |= 64;
      return interaction.reply(payload);
    }

    const status = interaction.options.getString('status');
    const rows = await prisma.modAppeal.findMany({ where: { guildId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 15 });
    if (!rows.length) return interaction.reply(v2Message(['No appeals found.'], { ephemeral: true, footer: false }));
    const lines = [`### ${em.modCase} Appeals`, ...rows.map(r => `**#${r.number}** <@${r.userId}> · ${r.status} · <t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`)];
    return interaction.reply(v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
  }
};
