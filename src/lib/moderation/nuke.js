const { ChannelType, PermissionFlagsBits } = require('discord.js');
const prisma = require('../db');
const store = require('../security/store');
const { securityLog } = require('../security/alerts');
const { em } = require('../emojis');
const { v2Message } = require('../components');

const COOLDOWN = new Map();
const TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

async function usage(channelId) {
  const checks = await Promise.all([
    prisma.panel.findFirst({ where: { OR: [{ channelId }, { transcriptChannelId: channelId }] } }),
    prisma.ticket.findFirst({ where: { channelId } }),
    prisma.applicationPanel.findFirst({ where: { OR: [{ channelId }, { reviewChannelId: channelId }] } }),
    prisma.greetSettings.findFirst({ where: { OR: [{ joinChannelId: channelId }, { leaveChannelId: channelId }, { banChannelId: channelId }] } }),
    prisma.levelSettings.findFirst({ where: { levelUpChannelId: channelId } }),
    prisma.interactiveMessage.findFirst({ where: { OR: [{ channelId }, { logChannelId: channelId }] } })
  ]);
  const names = ['a ticket panel', 'a ticket', 'an application panel', 'greet messages', 'level-up messages', 'a role or button message'];
  return names.filter((_, i) => checks[i]);
}

async function repoint(guild, oldId, newId) {
  const config = await store.loadConfig(guild.id);
  const keys = [
    ['core', 'logChannelId', config.core.logChannelId],
    ['moderation', 'logChannelId', config.moderation.logChannelId],
    ['verification', 'panelChannelId', config.verification && config.verification.panelChannelId]
  ];
  for (const [module, key, value] of keys) if (value === oldId) await store.setRaw(guild.id, module, key, newId).catch(() => {});
  await prisma.securityLock.updateMany({ where: { guildId: guild.id, channelId: oldId }, data: { channelId: newId } }).catch(() => {});
}

async function checkNuke({ guild, channel, userId, config }) {
  if (config.nukeTrustedOnly && !(await store.isUserTrusted(guild, userId, 'moderation'))) return 'Nuke is limited to trusted users (owner, extra owners and the moderation whitelist).';
  if (!TYPES.includes(channel.type)) return 'Only text and announcement channels can be nuked.';
  if (guild.rulesChannelId === channel.id || guild.publicUpdatesChannelId === channel.id || guild.systemChannelId === channel.id) return 'That channel is used by Discord (rules, updates or system messages) and cannot be nuked.';
  if (!channel.permissionsFor(guild.members.me).has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel])) return 'I need Manage Channels there.';
  if (Date.now() - (COOLDOWN.get(guild.id) || 0) < 30000) return 'Another nuke ran moments ago. Wait a little.';
  const used = await usage(channel.id);
  if (used.length) return `<#${channel.id}> is used by ${used.join(', ')}. Move those first so nothing breaks.`;
  return null;
}

async function executeNuke({ guild, channel, user }) {
  COOLDOWN.set(guild.id, Date.now());
  let clone;
  try {
    clone = await channel.clone({ reason: `Nuke by ${user.tag}` });
    await clone.setPosition(channel.position).catch(() => {});
    await repoint(guild, channel.id, clone.id);
    await channel.delete(`Nuke by ${user.tag}`);
  } catch {
    if (clone) await clone.delete().catch(() => {});
    return null;
  }
  await securityLog(guild, { module: 'moderation', action: 'nuke', executorId: user.id, lines: [`Channel #${channel.name} was wiped and recreated as <#${clone.id}>`] });
  await clone.send(v2Message([`${em.modNuke} Channel nuked by <@${user.id}>.`], { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
  return clone;
}

module.exports = { checkNuke, executeNuke, TYPES };
