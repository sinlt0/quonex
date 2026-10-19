const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Moderation history for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  category: 'Moderation',
  usage: '/history <user>',
  async execute(interaction) {
    await begin(interaction);
    const user = interaction.options.getUser('user');
    const [rows, total] = await cases.listCases(interaction.guild.id, { userId: user.id, take: 8 });
    const counts = {};
    const all = await cases.listCases(interaction.guild.id, { userId: user.id, take: 200 });
    for (const row of all[0]) counts[row.action] = (counts[row.action] || 0) + 1;
    const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'clean record';
    const prisma = require('../../../../lib/db');
    const [noteCount, watched] = await Promise.all([
      prisma.modNote.count({ where: { guildId: interaction.guild.id, userId: user.id } }),
      prisma.modWatch.findUnique({ where: { guildId_userId: { guildId: interaction.guild.id, userId: user.id } } })
    ]);
    const lines = [`### ${em.modCase} ${user.tag} · ${total} case${total === 1 ? '' : 's'}`, summary];
    if (noteCount || watched) lines.push(`${noteCount} note${noteCount === 1 ? '' : 's'}${watched ? ' · on the watchlist' : ''}`);
    for (const row of rows) lines.push(`**#${row.caseNumber}** ${engine.LABELS[row.action] || row.action} · <t:${Math.floor(row.createdAt.getTime() / 1000)}:d> · ${row.reason || '*no reason*'}`);
    return send(interaction, lines);
  }
};
