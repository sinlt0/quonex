const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../../lib/db');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Private staff notes about a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(s =>
      s
        .setName('add')
        .setDescription('Add a note')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('text').setDescription('Note').setRequired(true).setMaxLength(500))
    )
    .addSubcommand(s => s.setName('list').setDescription('Show notes').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a note').addIntegerOption(o => o.setName('id').setDescription('Note ID').setRequired(true).setMinValue(1))),
  category: 'Moderation',
  usage: '/note <add|list|remove>',
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const send = lines => interaction.reply(v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const count = await prisma.modNote.count({ where: { guildId, userId: user.id } });
      if (count >= 50) return send([`${em.alert} That member already has 50 notes.`]);
      await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
      const note = await prisma.modNote.create({ data: { guildId, userId: user.id, authorId: interaction.user.id, content: interaction.options.getString('text') } });
      return send([`${em.on} Note #${note.id} added for **${user.tag}**.`]);
    }

    if (sub === 'list') {
      const user = interaction.options.getUser('user');
      const notes = await prisma.modNote.findMany({ where: { guildId, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 15 });
      if (!notes.length) return send([`**${user.tag}** has no notes.`]);
      return send([`### ${em.modCase} Notes for ${user.tag}`, ...notes.map(n => `**#${n.id}** <t:${Math.floor(n.createdAt.getTime() / 1000)}:d> by <@${n.authorId}>\n> ${n.content}`)]);
    }

    const id = interaction.options.getInteger('id');
    const result = await prisma.modNote.deleteMany({ where: { id, guildId } });
    return send([result.count ? `${em.on} Note #${id} removed.` : `${em.alert} Note not found.`]);
  }
};
