const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const prisma = require('../db');
const { loadConfig, isUserTrusted, addTimer } = require('./store');
const { punish } = require('./punish');
const { lockServer, unlockServer } = require('./lockdown');
const { securityLog } = require('./alerts');
const { NUKE_EVENTS } = require('../../config/security');
const { em } = require('../emojis');

const SNAPSHOT_MS = 10 * 60 * 1000;
const deletedChannels = new Map();
const deletedRoles = new Map();
const windows = new Map();
const recentPunish = new Map();
const panicUntil = new Map();

const ACTION_MAP = {
  [AuditLogEvent.ChannelCreate]: 'channelCreate',
  [AuditLogEvent.ChannelDelete]: 'channelDelete',
  [AuditLogEvent.RoleCreate]: 'roleCreate',
  [AuditLogEvent.RoleDelete]: 'roleDelete',
  [AuditLogEvent.MemberBanAdd]: 'memberBan',
  [AuditLogEvent.MemberKick]: 'memberKick',
  [AuditLogEvent.MemberPrune]: 'memberPrune',
  [AuditLogEvent.WebhookCreate]: 'webhookCreate',
  [AuditLogEvent.WebhookDelete]: 'webhookDelete',
  [AuditLogEvent.EmojiDelete]: 'emojiDelete',
  [AuditLogEvent.BotAdd]: 'botAdd'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function remember(map, id, snapshot) {
  map.set(id, { snapshot, expires: Date.now() + SNAPSHOT_MS });
  for (const [key, value] of map) {
    if (value.expires < Date.now()) map.delete(key);
  }
}

function rememberChannel(channel) {
  if (!channel.guild) return;
  remember(deletedChannels, channel.id, {
    name: channel.name,
    type: channel.type,
    topic: channel.topic || undefined,
    nsfw: channel.nsfw || false,
    rateLimitPerUser: channel.rateLimitPerUser || 0,
    bitrate: channel.bitrate || undefined,
    userLimit: channel.userLimit || undefined,
    parentId: channel.parentId || null,
    position: channel.rawPosition,
    overwrites: channel.permissionOverwrites
      ? channel.permissionOverwrites.cache.map(item => ({ id: item.id, type: item.type, allow: item.allow.bitfield, deny: item.deny.bitfield }))
      : []
  });
}

function rememberRole(role) {
  remember(deletedRoles, role.id, {
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield,
    position: role.rawPosition
  });
}

async function waitSnapshot(map, id) {
  for (let i = 0; i < 6; i += 1) {
    const found = map.get(id);
    if (found) return found.snapshot;
    await sleep(250);
  }
  return null;
}

function dangerousMask(config) {
  let mask = 0n;
  for (const name of config.dangerousPermissions) {
    if (PermissionFlagsBits[name] !== undefined) mask |= PermissionFlagsBits[name];
  }
  return mask;
}

function changeOf(entry, key) {
  return (entry.changes || []).find(change => change.key === key);
}

function classify(entry, guild, config) {
  const events = [];
  const mapped = ACTION_MAP[entry.action];
  if (mapped) events.push(mapped);

  switch (entry.action) {
    case AuditLogEvent.ChannelUpdate:
      events.push('channelUpdate');
      break;
    case AuditLogEvent.RoleUpdate: {
      events.push('roleUpdate');
      const change = changeOf(entry, 'permissions');
      if (change && change.old !== undefined && change.new !== undefined) {
        const added = BigInt(change.new) & ~BigInt(change.old) & dangerousMask(config);
        if (added !== 0n) events.push('dangerousRole');
      }
      break;
    }
    case AuditLogEvent.MemberRoleUpdate: {
      const change = changeOf(entry, '$add');
      const mask = dangerousMask(config);
      if (change && Array.isArray(change.new)) {
        const risky = change.new.some(item => {
          const role = guild.roles.cache.get(item.id);
          return role && !role.managed && (role.permissions.bitfield & mask) !== 0n;
        });
        if (risky) events.push('dangerousGrant');
      }
      break;
    }
    case AuditLogEvent.MemberUpdate: {
      const change = changeOf(entry, 'communication_disabled_until');
      if (change && change.new) events.push('memberTimeout');
      break;
    }
    case AuditLogEvent.GuildUpdate:
      events.push(changeOf(entry, 'vanity_url_code') ? 'vanityChange' : 'guildUpdate');
      break;
    default:
      break;
  }

  return events;
}

function record(guildId, userId, event, seconds, data) {
  const key = `${guildId}:${userId}:${event}`;
  const now = Date.now();
  const list = (windows.get(key) || []).filter(item => now - item.t < seconds * 1000);
  list.push({ t: now, ...data });
  windows.set(key, list);
  return list;
}

async function revertRecords(guild, event, records, config) {
  let reverted = 0;
  for (const item of records) {
    try {
      switch (event) {
        case 'channelCreate': {
          const channel = guild.channels.cache.get(item.targetId);
          if (channel) {
            await channel.delete('Quonex anti-nuke: revert');
            reverted += 1;
          }
          break;
        }
        case 'channelDelete': {
          const snapshot = await waitSnapshot(deletedChannels, item.targetId);
          if (!snapshot) break;
          const overwrites = snapshot.overwrites.filter(entry => entry.type === 1 || guild.roles.cache.has(entry.id));
          await guild.channels.create({
            name: snapshot.name,
            type: snapshot.type,
            topic: snapshot.topic,
            nsfw: snapshot.nsfw,
            rateLimitPerUser: snapshot.rateLimitPerUser,
            bitrate: snapshot.bitrate,
            userLimit: snapshot.userLimit,
            parent: snapshot.parentId && guild.channels.cache.has(snapshot.parentId) ? snapshot.parentId : undefined,
            permissionOverwrites: overwrites.map(entry => ({ id: entry.id, type: entry.type, allow: BigInt(entry.allow), deny: BigInt(entry.deny) })),
            reason: 'Quonex anti-nuke: restore deleted channel'
          });
          reverted += 1;
          break;
        }
        case 'roleCreate': {
          const role = guild.roles.cache.get(item.targetId);
          if (role) {
            await role.delete('Quonex anti-nuke: revert');
            reverted += 1;
          }
          break;
        }
        case 'roleDelete': {
          const snapshot = await waitSnapshot(deletedRoles, item.targetId);
          if (!snapshot) break;
          await guild.roles.create({
            name: snapshot.name,
            color: snapshot.color,
            hoist: snapshot.hoist,
            mentionable: snapshot.mentionable,
            permissions: BigInt(snapshot.permissions),
            reason: 'Quonex anti-nuke: restore deleted role'
          });
          reverted += 1;
          break;
        }
        case 'roleUpdate':
        case 'dangerousRole': {
          const role = guild.roles.cache.get(item.targetId);
          if (role && item.oldPermissions !== undefined) {
            await role.setPermissions(BigInt(item.oldPermissions), 'Quonex anti-nuke: revert permissions');
            reverted += 1;
          }
          break;
        }
        case 'dangerousGrant': {
          const member = await guild.members.fetch(item.targetId).catch(() => null);
          if (member && item.roleIds && item.roleIds.length) {
            await member.roles.remove(item.roleIds, 'Quonex anti-nuke: revert dangerous role');
            reverted += 1;
          }
          break;
        }
        case 'memberBan':
          await guild.members.unban(item.targetId, 'Quonex anti-nuke: revert mass ban');
          reverted += 1;
          break;
        case 'webhookCreate': {
          const webhook = await guild.client.fetchWebhook(item.targetId).catch(() => null);
          if (webhook) {
            await webhook.delete('Quonex anti-nuke: revert');
            reverted += 1;
          }
          break;
        }
        case 'botAdd':
          await guild.members.kick(item.targetId, 'Quonex anti-nuke: unauthorised bot');
          reverted += 1;
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Anti-nuke revert ${event} failed:`, error.message);
    }
  }
  return reverted;
}

async function startPanic(guild, reason, minutes) {
  const until = Date.now() + minutes * 60 * 1000;
  if ((panicUntil.get(guild.id) || 0) > Date.now()) return false;
  panicUntil.set(guild.id, until);

  await addTimer({ guildId: guild.id, kind: 'panic-end', targetId: guild.id, expiresAt: new Date(until) });
  const locked = await lockServer(guild, { reason: `Panic mode: ${reason}` });
  await securityLog(guild, {
    module: 'antinuke',
    action: 'panic mode started',
    severity: 'critical',
    lines: [`Locked ${locked} channels for ${minutes} minutes.`, `Reason: ${reason}`, 'End it early with `/security panic end`.']
  });
  return true;
}

async function endPanic(guild, by) {
  panicUntil.delete(guild.id);
  await prisma.securityTimer.deleteMany({ where: { guildId: guild.id, kind: 'panic-end' } });
  const unlocked = await unlockServer(guild, { reason: 'Panic mode ended' });
  await securityLog(guild, {
    module: 'antinuke',
    action: 'panic mode ended',
    executorId: by || null,
    lines: [`Unlocked ${unlocked} channels.`]
  });
  return unlocked;
}

function isPanic(guildId) {
  return (panicUntil.get(guildId) || 0) > Date.now();
}

async function processEvent({ guild, config, entry, executorId, event, extra }) {
  if (!config[`${event}.enabled`]) return;
  if (await isUserTrusted(guild, executorId, 'antinuke', event)) return;

  const limit = config[`${event}.limit`];
  const seconds = config[`${event}.seconds`];
  const list = record(guild.id, executorId, event, seconds, { targetId: entry.targetId, ...extra });
  if (list.length < limit) return;

  const lastPunish = recentPunish.get(`${guild.id}:${executorId}`) || 0;
  const records = list.slice();
  windows.delete(`${guild.id}:${executorId}:${event}`);

  let reverted = 0;
  if (config.revert) reverted = await revertRecords(guild, event, records, config);

  if (Date.now() - lastPunish < 15000) return;
  recentPunish.set(`${guild.id}:${executorId}`, Date.now());

  const label = NUKE_EVENTS.find(item => item.id === event).label;
  const configured = config[`${event}.punishment`];
  const action = configured === 'default' ? config.punishment : configured;
  const reason = `Anti-nuke: ${label} (${records.length} in ${seconds}s)`;
  const result = await punish({ guild, userId: executorId, action, reason, timeoutMinutes: config.timeoutMinutes });

  await securityLog(guild, {
    module: 'antinuke',
    action: `${label} limit reached`,
    severity: 'critical',
    executorId,
    targetId: entry.targetId && /^\d+$/.test(entry.targetId) && entry.targetId !== executorId ? entry.targetId : null,
    detail: { event, count: records.length, seconds, action, reverted, ok: result.ok },
    lines: [
      `${records.length} actions in ${seconds}s (limit ${limit}).`,
      result.ok ? `Punishment applied: **${result.applied}**.` : `Punishment **${action}** failed: ${result.error}. Move my role higher than theirs.`,
      config.revert ? `Reverted ${reverted} change${reverted === 1 ? '' : 's'}.` : 'Revert is off.'
    ]
  });

  if (config.panicOnTrigger && !isPanic(guild.id)) {
    await startPanic(guild, `${label} by <@${executorId}>`, config.panicMinutes);
  }
}

async function handleAuditEntry(entry, guild) {
  const config = (await loadConfig(guild.id)).antinuke;
  if (!config.enabled) return;

  const executorId = entry.executorId;
  if (!executorId || executorId === guild.client.user.id) return;
  if (config.ignoreBotExecutors && entry.executor && entry.executor.bot) return;

  const events = classify(entry, guild, config);
  for (const event of events) {
    let extra = {};
    if (event === 'roleUpdate' || event === 'dangerousRole') {
      const change = changeOf(entry, 'permissions');
      if (change && change.old !== undefined) extra = { oldPermissions: String(change.old) };
    }
    if (event === 'dangerousGrant') {
      const change = changeOf(entry, '$add');
      const mask = dangerousMask(config);
      extra = {
        roleIds: (change.new || [])
          .map(item => item.id)
          .filter(id => {
            const role = guild.roles.cache.get(id);
            return role && (role.permissions.bitfield & mask) !== 0n;
          })
      };
    }
    await processEvent({ guild, config, entry, executorId, event, extra });
  }
}

async function handleEveryoneMention(message) {
  if (!message.guild || message.author.bot || !message.mentions.everyone) return false;
  const config = (await loadConfig(message.guild.id)).antinuke;
  if (!config.enabled || !config['everyoneMention.enabled']) return false;
  if (await isUserTrusted(message.guild, message.author.id, 'antinuke', 'everyoneMention')) return false;

  await message.delete().catch(() => {});
  await processEvent({
    guild: message.guild,
    config,
    entry: { targetId: message.channelId },
    executorId: message.author.id,
    event: 'everyoneMention',
    extra: {}
  });
  return true;
}

module.exports = { handleAuditEntry, handleEveryoneMention, rememberChannel, rememberRole, startPanic, endPanic, isPanic };
