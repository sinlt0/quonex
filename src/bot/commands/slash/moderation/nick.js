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
    .setName('nick')
    .setDescription('Change or reset a member nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname (empty resets)').setMaxLength(32)),
  category: 'Moderation',
  usage: '/nick <user> [nickname]',
  async execute(interaction) {
    const config = await begin(interaction);
    const guild = interaction.guild;
    const user = interaction.options.getUser('user');
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return fail(interaction, 'That member is not in the server.');
    if (member.id !== interaction.user.id) {
      const blocked = await engine.checkTarget({ guild, config, moderator: interaction.member, user, member, action: 'rename' });
      if (blocked) return fail(interaction, blocked);
    }
    try {
      await member.setNickname(interaction.options.getString('nickname') || null, `Nick by ${interaction.user.tag}`);
    } catch {
      return fail(interaction, 'I could not change that nickname.');
    }
    return send(interaction, [`${em.on} Nickname updated for **${user.tag}**.`]);
  }
};
