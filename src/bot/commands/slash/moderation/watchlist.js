const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../../lib/db');
const watch = require('../../../../lib/moderation/watch');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Get alerted when a flagged user joins or speaks')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(s =>
      s
        .setName('add')
        .setDescription('Add a user')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Why they are watched').setMaxLength(300))
    )
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Show watched users')),
  category: 'Moderation',
  usage: '/watchlist <add|remove|list>',
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const send = lines => interaction.reply(v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const rows = await prisma.modWatch.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 25 });
      if (!rows.length) return send(['The watchlist is empty.']);
      return send([`### ${em.modWarn} Watchlist (${rows.length})`, ...rows.map(r => `<@${r.userId}> · ${r.reason || 'No reason'} · by <@${r.addedBy}>`)]);
    }

    const user = interaction.options.getUser('user');
    if (sub === 'remove') {
      const result = await prisma.modWatch.deleteMany({ where: { guildId, userId: user.id } });
      watch.forget(guildId);
      return send([result.count ? `${em.on} **${user.tag}** removed from the watchlist.` : `${em.alert} They are not on the watchlist.`]);
    }

    if (user.bot) return send([`${em.alert} Bots cannot be watched.`]);
    const total = await prisma.modWatch.count({ where: { guildId } });
    if (total >= 100) return send([`${em.alert} The watchlist is full (100).`]);
    await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
    const reason = interaction.options.getString('reason');
    await prisma.modWatch.upsert({ where: { guildId_userId: { guildId, userId: user.id } }, update: { reason, addedBy: interaction.user.id }, create: { guildId, userId: user.id, reason, addedBy: interaction.user.id } });
    watch.forget(guildId);
    return send([`${em.on} **${user.tag}** is on the watchlist.`]);
  }
};
