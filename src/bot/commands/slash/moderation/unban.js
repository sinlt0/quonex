const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { begin, needReason, fail, readDuration, caseLine, send, formatDuration } = require('../../../../lib/moderation/common');
const { banUser, unbanUser, softbanUser } = require('../../../../lib/moderation/engine');


const unban = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption(o => o.setName('user').setDescription('Banned user').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450)),
  category: 'Moderation',
  usage: '/unban <user> [reason]',
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const bans = await interaction.guild.bans.fetch().catch(() => null);
    if (!bans) return interaction.respond([]);
    const choices = [...bans.values()]
      .filter(b => b.user.tag.toLowerCase().includes(focused) || b.user.id.startsWith(focused))
      .slice(0, 25)
      .map(b => ({ name: `${b.user.tag} (${b.user.id})`.slice(0, 100), value: b.user.id }));
    return interaction.respond(choices);
  },
  async execute(interaction) {
    const config = await begin(interaction);
    const { reason, error } = needReason(interaction, config);
    if (error) return fail(interaction, error);
    const id = interaction.options.getString('user').trim();
    if (!/^\d{15,22}$/.test(id)) return fail(interaction, 'Pick a user from the list or paste their ID.');
    const res = await unbanUser({ guild: interaction.guild, moderator: interaction.member, userId: id, reason });
    if (!res.ok) return fail(interaction, res.error);
    return send(interaction, [caseLine(res, 'Unbanned')]);
  }
};

module.exports = unban;
