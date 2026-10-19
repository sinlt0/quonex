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
    .setName('massban')
    .setDescription('Ban several users by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption(o => o.setName('ids').setDescription('User IDs separated by spaces or commas').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(450)),
  category: 'Moderation',
  usage: '/massban <ids> [reason]',
  async execute(interaction) {
    const config = await begin(interaction);
    if (config.massBanTrustedOnly && !(await store.isUserTrusted(interaction.guild, interaction.user.id, 'moderation'))) {
      return fail(interaction, 'Mass ban is limited to trusted users (owner, extra owners and the moderation whitelist).');
    }
    const ids = [...new Set(interaction.options.getString('ids').match(/\d{15,22}/g) || [])];
    if (!ids.length) return fail(interaction, 'No valid user IDs found.');
    if (ids.length > config.massBanMax) return fail(interaction, `You can ban at most ${config.massBanMax} users at once.`);
    const reason = interaction.options.getString('reason');
    if (config.requireReason && !reason) return fail(interaction, 'This server requires a reason.');

    let done = 0;
    const failed = [];
    for (const id of ids) {
      const res = await engine.banUser({ guild: interaction.guild, moderator: interaction.member, userId: id, reason, silent: true });
      if (res.ok) done += 1;
      else failed.push(`\`${id}\` ${res.error}`);
    }
    const lines = [`${em.on} Banned **${done}** of ${ids.length}.`];
    if (failed.length) lines.push(...failed.slice(0, 10));
    return send(interaction, lines);
  }
};
