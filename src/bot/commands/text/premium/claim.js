const { PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../../lib/db');
const { PREMIUM_DURATIONS } = require('../../../../config/durations');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'premiumclaim',
  category: 'Premium',
  description: 'Claim a premium key for this server',
  usage: 'premiumclaim <key>',
  async execute(message, args) {
    if (!message.guild) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply(v2Message([`${em.error} You need the Manage Server permission to claim premium.`, supportLine()]));
      return;
    }

    const keyValue = (args[0] || '').toUpperCase();
    const key = await prisma.premiumKey.findUnique({ where: { key: keyValue } });

    if (!key || key.claimedAt) {
      await message.reply(v2Message([`${em.error} Invalid or already used key.`, supportLine()]));
      return;
    }

    const duration = PREMIUM_DURATIONS.find(item => item.id === key.duration);
    const guildId = message.guild.id;

    const existing = await prisma.premium.findUnique({ where: { guildId } });
    const base = existing && existing.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt.getTime() : Date.now();
    const expiresAt = duration.ms === null ? null : new Date(base + duration.ms);

    await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
    await prisma.premium.upsert({
      where: { guildId },
      update: { expiresAt, lifetime: duration.ms === null, addedBy: message.author.id },
      create: { guildId, expiresAt, lifetime: duration.ms === null, addedBy: message.author.id }
    });
    await prisma.premiumKey.update({
      where: { key: keyValue },
      data: { claimedBy: message.author.id, claimedAt: new Date(), usedGuildId: guildId }
    });

    await message.reply(v2Message([`${em.success} Premium (${duration.label}) claimed for this server.`]));
  }
};
