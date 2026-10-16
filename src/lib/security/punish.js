const { PermissionFlagsBits } = require('discord.js');
const prisma = require('../db');
const { v2Message } = require('../components');
const { loadConfig, setRaw } = require('./store');
const { em } = require('../emojis');

const TIMEOUT_MAX_MS = 28 * 24 * 60 * 60 * 1000;

function myTop(guild) {
  return guild.members.me ? guild.members.me.roles.highest.position : 0;
}

function canActOn(guild, member) {
  if (!member) return true;
  if (member.id === guild.ownerId || member.id === guild.client.user.id) return false;
  return member.roles.highest.position < myTop(guild);
}

async function ensureQuarantineRole(guild) {
  const config = (await loadConfig(guild.id)).core;
  const existing = config.quarantineRoleId ? guild.roles.cache.get(config.quarantineRoleId) : null;
  if (existing) return existing;

  const role = await guild.roles.create({ name: 'Quarantined', color: 0x555555, permissions: [], reason: 'Quonex security: quarantine role' });
  await setRaw(guild.id, 'core', 'quarantineRoleId', role.id);

  (async () => {
    for (const channel of guild.channels.cache.values()) {
      if (channel.isThread()) continue;
      await channel.permissionOverwrites
        .edit(role, { ViewChannel: false, SendMessages: false, Connect: false, AddReactions: false }, { reason: 'Quonex security: quarantine role' })
        .catch(() => {});
    }
  })();

  return role;
}

async function quarantineMember(guild, member, reason, by) {
  const role = await ensureQuarantineRole(guild);
  const config = (await loadConfig(guild.id)).core;
  const top = myTop(guild);

  const removable = member.roles.cache.filter(item => item.id !== guild.id && !item.managed && item.position < top);
  const saved = member.roles.cache.filter(item => item.id !== guild.id && !item.managed).map(item => item.id);

  await prisma.quarantineEntry.upsert({
    where: { guildId_userId: { guildId: guild.id, userId: member.id } },
    update: { roleIds: saved, reason: reason || null, createdBy: by },
    create: { guildId: guild.id, userId: member.id, roleIds: saved, reason: reason || null, createdBy: by }
  });

  if (config.quarantineRemoveRoles) {
    const keep = member.roles.cache.filter(item => item.id !== guild.id && !removable.has(item.id)).map(item => item.id);
    await member.roles.set([...new Set([...keep, role.id])], reason || 'Quarantine');
  } else {
    await member.roles.add(role.id, reason || 'Quarantine');
  }
  return true;
}

async function releaseMember(guild, userId, by) {
  const entry = await prisma.quarantineEntry.findUnique({ where: { guildId_userId: { guildId: guild.id, userId } } });
  const config = (await loadConfig(guild.id)).core;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    if (entry) await prisma.quarantineEntry.delete({ where: { id: entry.id } });
    return { ok: Boolean(entry), left: true };
  }

  const top = myTop(guild);
  const current = member.roles.cache.filter(item => item.id !== guild.id && item.id !== config.quarantineRoleId).map(item => item.id);
  const restore = entry ? entry.roleIds.filter(id => {
    const role = guild.roles.cache.get(id);
    return role && !role.managed && role.position < top;
  }) : [];

  await member.roles.set([...new Set([...current, ...restore])], `Released from quarantine by ${by}`);
  if (entry) await prisma.quarantineEntry.delete({ where: { id: entry.id } });
  return { ok: true, restored: restore.length };
}

async function dangerousRoleIds(guild, member) {
  const config = (await loadConfig(guild.id)).antinuke;
  const names = config.dangerousPermissions.filter(name => PermissionFlagsBits[name] !== undefined);
  return member.roles.cache
    .filter(role => role.id !== guild.id && !role.managed && names.some(name => role.permissions.has(PermissionFlagsBits[name])))
    .map(role => role.id);
}

async function notifyOffender(guild, userId, action, reason) {
  const user = await guild.client.users.fetch(userId).catch(() => null);
  if (!user) return;
  const verb = action === 'ban' ? 'banned from' : 'removed from';
  await user.send(v2Message([`You were ${verb} **${guild.name}**.`, `Reason: ${reason}`], { footer: false })).catch(() => {});
}

async function punish({ guild, userId, action, reason, timeoutMinutes = 60, deleteSeconds = 0, by }) {
  if (!action || action === 'none') return { ok: true, applied: 'none' };

  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  if (member && !canActOn(guild, member)) return { ok: false, applied: action, error: 'hierarchy' };
  if (!member && action !== 'ban') return { ok: false, applied: action, error: 'not-in-server' };

  const config = (await loadConfig(guild.id)).core;
  const tag = reason ? `Quonex security: ${reason}`.slice(0, 480) : 'Quonex security';

  try {
    switch (action) {
      case 'strip': {
        const ids = await dangerousRoleIds(guild, member);
        if (ids.length) await member.roles.remove(ids, tag);
        return { ok: true, applied: `strip (${ids.length} roles)` };
      }
      case 'quarantine':
        await quarantineMember(guild, member, reason, by || guild.client.user.id);
        return { ok: true, applied: 'quarantine' };
      case 'timeout':
        await member.timeout(Math.min(timeoutMinutes * 60 * 1000, TIMEOUT_MAX_MS), tag);
        return { ok: true, applied: `timeout (${timeoutMinutes}m)` };
      case 'kick':
        if (config.dmOffenders) await notifyOffender(guild, userId, 'kick', reason);
        await member.kick(tag);
        return { ok: true, applied: 'kick' };
      case 'ban':
        if (member && config.dmOffenders) await notifyOffender(guild, userId, 'ban', reason);
        await guild.members.ban(userId, { reason: tag, deleteMessageSeconds: Math.min(deleteSeconds, 604800) });
        return { ok: true, applied: 'ban' };
      default:
        return { ok: false, applied: action, error: 'unknown-action' };
    }
  } catch (error) {
    console.error(`Security punishment ${action} failed:`, error.message);
    return { ok: false, applied: action, error: 'discord-error' };
  }
}

module.exports = { punish, canActOn, ensureQuarantineRole, quarantineMember, releaseMember, myTop };
