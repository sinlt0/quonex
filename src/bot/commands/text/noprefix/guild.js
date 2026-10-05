const { PermissionFlagsBits } = require('discord.js');
const { isGuildPremium } = require('../../../../lib/permissions');
const prisma = require('../../../../lib/db');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'np',
  category: 'No-Prefix',
  description: 'Manage no-prefix access for this server (premium only)',
  usage: 'np <enable|disable|enableuser|disableuser>',
  async execute(message, args) {
    if (!message.guild) return;

    const isServerOwner = message.guild.ownerId === message.author.id;
    const hasManage = message.member.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isServerOwner && !hasManage) {
      await message.reply(v2Message([`${em.error} You need to be the server owner or have Manage Server permission.`, supportLine()]));
      return;
    }

    const guildId = message.guild.id;
    const premium = await isGuildPremium(guildId);
    if (!premium) {
      await message.reply(v2Message([`${em.error} This server does not have premium.`, supportLine()]));
      return;
    }

    const sub = args[0];
    await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

    if (sub === 'enable') {
      await prisma.guildNoPrefix.upsert({
        where: { guildId },
        update: { mode: 'all', updatedBy: message.author.id },
        create: { guildId, mode: 'all', updatedBy: message.author.id }
      });
      await message.reply(v2Message([`${em.success} No-prefix commands are now enabled for everyone in this server.`]));
    } else if (sub === 'disable') {
      await prisma.guildNoPrefix.upsert({
        where: { guildId },
        update: { mode: 'none', updatedBy: message.author.id },
        create: { guildId, mode: 'none', updatedBy: message.author.id }
      });
      await message.reply(v2Message([`${em.success} No-prefix commands are now disabled for this server.`]));
    } else if (sub === 'enableuser') {
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply(v2Message([`${em.error} Usage: np enableuser @user`]));
        return;
      }
      const guildNp = await prisma.guildNoPrefix.upsert({
        where: { guildId },
        update: {},
        create: { guildId, mode: 'specific', updatedBy: message.author.id }
      });
      await prisma.guildNoPrefixUser.upsert({
        where: { guildNoPrefixId_userId: { guildNoPrefixId: guildNp.id, userId: target.id } },
        update: {},
        create: { guildNoPrefixId: guildNp.id, userId: target.id }
      });
      await message.reply(v2Message([`${em.success} ${target.tag} can now use no-prefix commands in this server.`]));
    } else if (sub === 'disableuser') {
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply(v2Message([`${em.error} Usage: np disableuser @user`]));
        return;
      }
      const guildNp = await prisma.guildNoPrefix.findUnique({ where: { guildId } });
      if (guildNp) {
        await prisma.guildNoPrefixUser.deleteMany({ where: { guildNoPrefixId: guildNp.id, userId: target.id } });
      }
      await message.reply(v2Message([`${em.success} ${target.tag} no longer has no-prefix access in this server.`]));
    } else {
      await message.reply(v2Message([`${em.error} Usage: np <enable|disable|enableuser|disableuser>`]));
    }
  }
};
