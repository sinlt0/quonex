const { ChannelType } = require('discord.js');
const prisma = require('../db');
const { v2Message } = require('../components');
const { loadConfig, isChannelExempt } = require('./store');
const { em } = require('../emojis');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia];
const VOICE_TYPES = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function permsFor(channel, config) {
  if (TEXT_TYPES.includes(channel.type)) {
    const keys = ['SendMessages'];
    if (config.denyReactions) keys.push('AddReactions');
    if (config.denyThreads) keys.push('CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads');
    return keys;
  }
  if (VOICE_TYPES.includes(channel.type) && config.denyVoice) return ['Connect'];
  return [];
}

function readPrev(channel, everyoneId, keys) {
  const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
  const prev = {};
  for (const key of keys) {
    if (overwrite && overwrite.allow.has(key)) prev[key] = true;
    else if (overwrite && overwrite.deny.has(key)) prev[key] = false;
    else prev[key] = null;
  }
  return prev;
}

async function lockChannel(channel, { reason } = {}) {
  const guild = channel.guild;
  const config = (await loadConfig(guild.id)).lockdown;
  const keys = permsFor(channel, config);
  if (!keys.length) return { ok: false, skipped: true };

  const existing = await prisma.securityLock.findUnique({ where: { guildId_channelId: { guildId: guild.id, channelId: channel.id } } });
  if (!existing) {
    await prisma.securityLock.create({ data: { guildId: guild.id, channelId: channel.id, prev: readPrev(channel, guild.id, keys) } });
  }

  const edit = {};
  for (const key of keys) edit[key] = false;
  await channel.permissionOverwrites.edit(guild.id, edit, { reason: reason || 'Quonex lockdown' });

  if (config.announce && channel.isTextBased() && TEXT_TYPES.includes(channel.type) && !existing) {
    await channel.send(v2Message([`${em.lock} ${config.lockMessage}`], { footer: false })).catch(() => {});
  }
  return { ok: true };
}

async function unlockChannel(channel, { reason } = {}) {
  const guild = channel.guild;
  const config = (await loadConfig(guild.id)).lockdown;
  const lock = await prisma.securityLock.findUnique({ where: { guildId_channelId: { guildId: guild.id, channelId: channel.id } } });
  if (!lock) return { ok: false, skipped: true };

  await channel.permissionOverwrites.edit(guild.id, lock.prev, { reason: reason || 'Quonex lockdown ended' }).catch(() => {});
  await prisma.securityLock.delete({ where: { id: lock.id } });

  if (config.announce && TEXT_TYPES.includes(channel.type)) {
    await channel.send(v2Message([`${em.unlock} ${config.unlockMessage}`], { footer: false })).catch(() => {});
  }
  return { ok: true };
}

async function lockServer(guild, { reason } = {}) {
  let locked = 0;
  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread() || channel.type === ChannelType.GuildCategory) continue;
    if (await isChannelExempt(guild.id, channel, 'lockdown')) continue;
    const result = await lockChannel(channel, { reason }).catch(() => ({ ok: false }));
    if (result.ok) locked += 1;
    await sleep(120);
  }
  return locked;
}

async function unlockServer(guild, { reason } = {}) {
  const locks = await prisma.securityLock.findMany({ where: { guildId: guild.id } });
  let unlocked = 0;
  for (const lock of locks) {
    const channel = guild.channels.cache.get(lock.channelId);
    if (!channel) {
      await prisma.securityLock.delete({ where: { id: lock.id } }).catch(() => {});
      continue;
    }
    const result = await unlockChannel(channel, { reason }).catch(() => ({ ok: false }));
    if (result.ok) unlocked += 1;
    await sleep(120);
  }
  return unlocked;
}

async function lockedChannelIds(guildId) {
  const locks = await prisma.securityLock.findMany({ where: { guildId } });
  return locks.map(lock => lock.channelId);
}

module.exports = { lockChannel, unlockChannel, lockServer, unlockServer, lockedChannelIds };
