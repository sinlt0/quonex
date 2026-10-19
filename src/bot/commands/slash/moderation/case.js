const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

const PAGE = 10;

function describe(row) {
  const label = engine.LABELS[row.action] || row.action;
  const length = row.duration ? ` (${formatDuration(row.duration)})` : '';
  return `**#${row.caseNumber}** ${engine.ICONS[row.action] || em.modCase} ${label}${length}${row.auto ? ' · auto' : ''} · <@${row.userId}> · <t:${Math.floor(row.createdAt.getTime() / 1000)}:d>\n> ${row.reason || '*no reason*'}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View and manage moderation cases')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(s => s.setName('view').setDescription('Show one case').addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)))
    .addSubcommand(s =>
      s
        .setName('reason')
        .setDescription('Change a case reason')
        .addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('reason').setDescription('New reason').setRequired(true).setMaxLength(450))
    )
    .addSubcommand(s => s.setName('delete').setDescription('Delete a case (Administrator)').addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)))
    .addSubcommand(s =>
      s
        .setName('list')
        .setDescription('Browse cases')
        .addUserOption(o => o.setName('user').setDescription('Filter by target'))
        .addUserOption(o => o.setName('moderator').setDescription('Filter by moderator'))
        .addIntegerOption(o => o.setName('page').setDescription('Page').setMinValue(1))
    ),
  category: 'Moderation',
  usage: '/case <view|reason|delete|list>',
  async execute(interaction) {
    await begin(interaction);
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const page = interaction.options.getInteger('page') || 1;
      const user = interaction.options.getUser('user');
      const moderator = interaction.options.getUser('moderator');
      const [rows, total] = await cases.listCases(guildId, { userId: user && user.id, moderatorId: moderator && moderator.id, skip: (page - 1) * PAGE, take: PAGE });
      if (!rows.length) return send(interaction, ['No cases found.']);
      return send(interaction, [`### ${em.modCase} Cases · page ${page}/${Math.max(1, Math.ceil(total / PAGE))} (${total})`, ...rows.map(describe)]);
    }

    const number = interaction.options.getInteger('number');
    const row = await cases.getCase(guildId, number);
    if (!row) return fail(interaction, 'Case not found.');

    if (sub === 'view') return send(interaction, [describe(row), `Moderator: <@${row.moderatorId}>`]);

    if (sub === 'reason') {
      await cases.setReason(guildId, number, interaction.options.getString('reason'));
      return send(interaction, [`${em.on} Case #${number} reason updated.`]);
    }

    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return fail(interaction, 'Only administrators can delete cases.');
    await cases.deleteCase(guildId, number);
    return send(interaction, [`${em.on} Case #${number} deleted.`]);
  }
};
