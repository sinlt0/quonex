const { ChannelType } = require('discord.js');
const prisma = require('../db');
const { loadConfig } = require('./store');
const { em } = require('../emojis');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function snapshotGuild(guild) {
  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id && !role.managed)
    .map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position
    }));

  const channels = guild.channels.cache
    .filter(channel => !channel.isThread())
    .map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId || null,
      topic: channel.topic || null,
      nsfw: Boolean(channel.nsfw),
      rateLimitPerUser: channel.rateLimitPerUser || 0,
      bitrate: channel.bitrate || null,
      userLimit: channel.userLimit || null,
      position: channel.rawPosition,
      overwrites: channel.permissionOverwrites
        ? channel.permissionOverwrites.cache.map(item => ({ id: item.id, type: item.type, allow: item.allow.bitfield.toString(), deny: item.deny.bitfield.toString() }))
        : []
    }));

  return { guildName: guild.name, takenAt: Date.now(), roles, channels };
}

async function createBackup(guild, { name, by, auto = false }) {
  const config = (await loadConfig(guild.id)).core;
  const data = snapshotGuild(guild);

  const existing = await prisma.securityBackup.findMany({ where: { guildId: guild.id, auto }, orderBy: { createdAt: 'asc' } });
  const overflow = existing.length - (config.maxBackups - 1);
  if (overflow > 0) {
    await prisma.securityBackup.deleteMany({ where: { id: { in: existing.slice(0, overflow).map(item => item.id) } } });
  }

  return prisma.securityBackup.create({
    data: { guildId: guild.id, name: name || `backup-${new Date().toISOString().slice(0, 16)}`, auto, data, createdBy: by }
  });
}

async function listBackups(guildId) {
  return prisma.securityBackup.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, auto: true, createdAt: true, data: true }
  });
}

async function deleteBackup(guildId, id) {
  const result = await prisma.securityBackup.deleteMany({ where: { guildId, id } });
  return result.count > 0;
}

async function restoreBackup(guild, backup, { roles = true, channels = true }) {
  const data = backup.data;
  const summary = { rolesCreated: 0, channelsCreated: 0, skipped: 0, failed: 0 };
  const roleMap = new Map();

  if (roles) {
    const sorted = [...data.roles].sort((a, b) => a.position - b.position);
    for (const item of sorted) {
      const existing = guild.roles.cache.find(role => role.name === item.name && !role.managed);
      if (existing) {
        roleMap.set(item.id, existing.id);
        summary.skipped += 1;
        continue;
      }
      try {
        const role = await guild.roles.create({
          name: item.name,
          color: item.color,
          hoist: item.hoist,
          mentionable: item.mentionable,
          permissions: BigInt(item.permissions),
          reason: 'Quonex backup restore'
        });
        roleMap.set(item.id, role.id);
        summary.rolesCreated += 1;
        await sleep(300);
      } catch {
        summary.failed += 1;
      }
    }
  }

  if (channels) {
    const categoryMap = new Map();
    const categories = data.channels.filter(item => item.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
    const others = data.channels.filter(item => item.type !== ChannelType.GuildCategory).sort((a, b) => a.position - b.position);

    const buildOverwrites = item =>
      item.overwrites
        .map(entry => ({ ...entry, id: entry.type === 0 ? roleMap.get(entry.id) || (guild.roles.cache.has(entry.id) ? entry.id : null) : entry.id }))
        .filter(entry => entry.id)
        .map(entry => ({ id: entry.id, type: entry.type, allow: BigInt(entry.allow), deny: BigInt(entry.deny) }));

    for (const item of categories) {
      const existing = guild.channels.cache.find(channel => channel.type === item.type && channel.name === item.name);
      if (existing) {
        categoryMap.set(item.id, existing.id);
        summary.skipped += 1;
        continue;
      }
      try {
        const created = await guild.channels.create({ name: item.name, type: item.type, permissionOverwrites: buildOverwrites(item), reason: 'Quonex backup restore' });
        categoryMap.set(item.id, created.id);
        summary.channelsCreated += 1;
        await sleep(400);
      } catch {
        summary.failed += 1;
      }
    }

    for (const item of others) {
      const parentId = item.parentId ? categoryMap.get(item.parentId) || (guild.channels.cache.has(item.parentId) ? item.parentId : null) : null;
      const existing = guild.channels.cache.find(
        channel => channel.type === item.type && channel.name === item.name && (channel.parentId || null) === (parentId || null)
      );
      if (existing) {
        summary.skipped += 1;
        continue;
      }
      try {
        await guild.channels.create({
          name: item.name,
          type: item.type,
          parent: parentId || undefined,
          topic: item.topic || undefined,
          nsfw: item.nsfw,
          rateLimitPerUser: item.rateLimitPerUser || undefined,
          bitrate: item.bitrate || undefined,
          userLimit: item.userLimit || undefined,
          permissionOverwrites: buildOverwrites(item),
          reason: 'Quonex backup restore'
        });
        summary.channelsCreated += 1;
        await sleep(400);
      } catch {
        summary.failed += 1;
      }
    }
  }

  return summary;
}

async function runAutoBackups(client) {
  const rows = await prisma.securitySettings.findMany();
  for (const row of rows) {
    const hours = row.config && row.config.core ? row.config.core.autoBackupHours : 0;
    if (!hours || hours < 1) continue;
    const guild = client.guilds.cache.get(row.guildId);
    if (!guild) continue;

    const last = await prisma.securityBackup.findFirst({ where: { guildId: row.guildId, auto: true }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < hours * 3600 * 1000) continue;
    await createBackup(guild, { name: `auto-${new Date().toISOString().slice(0, 16)}`, by: client.user.id, auto: true }).catch(error =>
      console.error('Auto backup failed:', error.message)
    );
  }
}

module.exports = { createBackup, listBackups, deleteBackup, restoreBackup, runAutoBackups, snapshotGuild };
