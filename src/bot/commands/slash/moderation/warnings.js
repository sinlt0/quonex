const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Show or clear a member\'s warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(s => s.setName('view').setDescription('Show active warnings').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s =>
      s
        .setName('remove')
        .setDescription('Remove one warning by case number')
        .addIntegerOption(o => o.setName('case').setDescription('Case number').setRequired(true).setMinValue(1))
    )
    .addSubcommand(s => s.setName('clear').setDescription('Clear all active warnings').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))),
  category: 'Moderation',
  usage: '/warnings <view|remove|clear>',
  async execute(interaction) {
    await begin(interaction);
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') {
      const user = interaction.options.getUser('user');
      const rows = await cases.activeWarns(guildId, user.id);
      if (!rows.length) return send(interaction, [`${em.on} **${user.tag}** has no active warnings.`]);
      const lines = [`### ${em.modWarn} Warnings for ${user.tag} (${rows.length})`];
      for (const row of rows.slice(0, 15)) lines.push(`**#${row.caseNumber}** <t:${Math.floor(row.createdAt.getTime() / 1000)}:R> by <@${row.moderatorId}> · ${row.reason}`);
      return send(interaction, lines);
    }
    if (sub === 'remove') {
      const number = interaction.options.getInteger('case');
      const row = await cases.getCase(guildId, number);
      if (!row || row.action !== 'warn') return fail(interaction, 'That case is not a warning.');
      await cases.deactivateWarn(guildId, number);
      return send(interaction, [`${em.on} Warning #${number} removed.`]);
    }
    const user = interaction.options.getUser('user');
    const count = await cases.clearWarns(guildId, user.id);
    return send(interaction, [`${em.on} Cleared ${typeof count === 'number' ? count : 'all'} warning(s) for **${user.tag}**.`]);
  }
};
