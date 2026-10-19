const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const prisma = require('../db');
const store = require('./store');
const { renderName, sanitizeName } = require('./names');
const { v2Message } = require('../components');
const { isUserTrusted } = require('../security/store');
const { isPanic } = require('../security/antinuke');
const { isRaid } = require('../security/antiraid');
const { em } = require('../emojis');

const OWNER_PERMS = P.ViewChannel | P.Connect | P.Speak | P.Stream | P.UseVAD;
const GUEST_PERMS = P.ViewChannel | P.Connect;
const MAX_LIST = 25;

const cooldowns = new Map();
const creating = new Set();
const graceTimers = new Map();

function humansIn(channel) {
  return channel.members.filter(m => !m.user.bot);
}

function mergeOverwrite(list, id, type, allowAdd, denyAdd) {
  let item = list.find(o => o.id === id);
  if (!item) {
    item = { id, type, allow: 0n, deny: 0n };
    list.push(item);
  }
  item.allow = (item.allow | allowAdd) & ~denyAdd;
  item.deny = (item.deny | denyAdd) & ~allowAdd;
}

function baseOverwrites(lobbyChannel) {
  return lobbyChannel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));
}

async function sendNotice(channel, lines) {
  await channel.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
}

async function logEvent(guild, settings, lines) {
  if (!settings.logChannelId) return;
  const channel = guild.channels.cache.get(settings.logChannelId);
  if (!channel || !channel.isTextBased()) return;
  await channel.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
}

async function denyCreate(member, text) {
  await member.user.send(v2Message([`${em.tvVoice} ${text}`], { footer: false })).catch(() => {});
  if (member.voice.channelId) await member.voice.disconnect('Temp voice: creation denied').catch(() => {});
}

async function checkCreate(member, lobby, settings) {
  const guild = member.guild;
  if (settings.blockDuringRaid && (isRaid(guild.id) || isPanic(guild.id))) return 'Voice room creation is paused while the server is under raid protection.';
  const quarantined = await prisma.quarantineEntry.findUnique({ where: { guildId_userId: { guildId: guild.id, userId: member.id } } });
  if (quarantined) return 'You cannot create rooms while quarantined.';
  if (lobby.blockedRoleIds.some(id => member.roles.cache.has(id))) return 'Your role is not allowed to create rooms here.';
  if (lobby.allowedRoleIds.length && !lobby.allowedRoleIds.some(id => member.roles.cache.has(id))) return 'You need a specific role to create rooms here.';
  const wait = lobby.cooldownSeconds * 1000 - (Date.now() - (cooldowns.get(`${lobby.id}:${member.id}`) || 0));
  if (wait > 0) return `Slow down, wait ${Math.ceil(wait / 1000)}s before creating another room.`;
  const total = await prisma.tempVoiceChannel.count({ where: { guildId: guild.id } });
  if (total >= settings.maxChannels) return 'This server reached its limit of temporary rooms. Try again soon.';
  return null;
}

async function createFor(member, lobbyChannel, lobby) {
  const guild = member.guild;
  const lockKey = `${guild.id}:${member.id}`;
  if (creating.has(lockKey)) return;
  creating.add(lockKey);
  try {
    const settings = await store.getSettings(guild.id);

    const existing = await store.ownedBy(guild.id, member.id);
    if (existing) {
      const channel = guild.channels.cache.get(existing.channelId);
      if (channel) {
        await member.voice.setChannel(channel).catch(() => {});
        return;
      }
      await store.removeTemp(existing.channelId);
    }

    const problem = await checkCreate(member, lobby, settings);
    if (problem) return denyCreate(member, problem);

    const profile = settings.saveProfiles ? await store.getProfile(guild.id, member.id) : null;
    const count = (await prisma.tempVoiceChannel.count({ where: { guildId: guild.id, lobbyId: lobby.id } })) + 1;
    const fallbackName = renderName(lobby.nameTemplate, member, count, settings.allowInvites);
    const name = profile && profile.name ? sanitizeName(profile.name, settings.allowInvites) || fallbackName : fallbackName;
    const limit = profile && profile.userLimit !== null && profile.userLimit !== undefined ? profile.userLimit : lobby.userLimit;
    const bitrateRaw = (profile && profile.bitrate) || lobby.bitrate || null;
    const bitrate = bitrateRaw ? Math.min(Math.max(bitrateRaw, 8000), guild.maximumBitrate) : undefined;

    const overwrites = baseOverwrites(lobbyChannel);
    const everyone = guild.roles.everyone.id;
    if (lobby.ownerManaged) {
      mergeOverwrite(overwrites, member.id, 1, OWNER_PERMS, 0n);
      if (profile && profile.locked) mergeOverwrite(overwrites, everyone, 0, 0n, P.Connect);
      if (profile && profile.hidden) mergeOverwrite(overwrites, everyone, 0, 0n, P.ViewChannel);
      if (profile) {
        for (const id of profile.trusted) mergeOverwrite(overwrites, id, 1, GUEST_PERMS, 0n);
        for (const id of profile.blocked) mergeOverwrite(overwrites, id, 1, 0n, GUEST_PERMS);
      }
    }
    mergeOverwrite(overwrites, guild.client.user.id, 1, P.ViewChannel | P.Connect | P.ManageChannels | P.MoveMembers | P.SendMessages, 0n);

    const channel = await guild.channels
      .create({
        name,
        type: ChannelType.GuildVoice,
        parent: lobby.categoryId || lobbyChannel.parentId || undefined,
        userLimit: Math.min(Math.max(limit || 0, 0), 99),
        bitrate,
        permissionOverwrites: overwrites,
        reason: `Temp voice for ${member.user.tag}`
      })
      .catch(error => {
        console.error('Temp voice create failed:', error.message);
        return null;
      });
    if (!channel) return denyCreate(member, 'I could not create your room. Ask an admin to check my permissions.');

    await store.saveTemp({ channelId: channel.id, guildId: guild.id, lobbyId: lobby.id, ownerId: member.id });
    cooldowns.set(`${lobby.id}:${member.id}`, Date.now());

    const moved = await member.voice.setChannel(channel).then(() => true, () => false);
    if (!moved) {
      await store.removeTemp(channel.id);
      await channel.delete('Temp voice: owner left before the move').catch(() => {});
      return;
    }

    if (settings.panelEnabled && lobby.ownerManaged) {
      const { buildPanel } = require('./panel');
      const sent = await channel.send(await buildPanel(channel, { ownerId: member.id, lobby })).catch(() => null);
      if (sent) await store.updateTemp(channel.id, { panelMessageId: sent.id });
    }
    await logEvent(guild, settings, [`${em.tvCreate} <@${member.id}> created **${channel.name}**`]);
  } finally {
    creating.delete(lockKey);
  }
}

function clearGrace(channelId) {
  const timer = graceTimers.get(channelId);
  if (timer) clearTimeout(timer);
  graceTimers.delete(channelId);
}

async function removeChannel(guild, channelId, reason) {
  const channel = guild.channels.cache.get(channelId);
  clearGrace(channelId);
  await store.removeTemp(channelId);
  if (channel) await channel.delete(reason).catch(() => {});
}

async function pickSuccessor(channel, excludeId) {
  for (const member of humansIn(channel).values()) {
    if (member.id === excludeId) continue;
    if (!(await store.ownedBy(channel.guild.id, member.id))) return member;
  }
  return null;
}

async function applyOwner(channel, temp, newOwnerId) {
  const oldOwnerId = temp.ownerId;
  await store.updateTemp(channel.id, { ownerId: newOwnerId });
  await channel.permissionOverwrites.edit(newOwnerId, { ViewChannel: true, Connect: true, Speak: true, Stream: true, UseVAD: true }).catch(() => {});
  if (oldOwnerId === newOwnerId) return;
  const newProfile = await store.getProfile(channel.guild.id, newOwnerId);
  const keepOld = newProfile && newProfile.trusted.includes(oldOwnerId);
  if (!keepOld) await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});
}

async function refreshPanel(channel) {
  const temp = await store.getTemp(channel.id);
  if (!temp || !temp.panelMessageId) return;
  const lobby = await store.getLobbyById(temp.lobbyId);
  const message = await channel.messages.fetch(temp.panelMessageId).catch(() => null);
  if (!message) return;
  const { buildPanel } = require('./panel');
  await message.edit(await buildPanel(channel, { ownerId: temp.ownerId, lobby })).catch(() => {});
}

async function startGrace(channel) {
  clearGrace(channel.id);
  const settings = await store.getSettings(channel.guild.id);
  if (!settings.autoTransfer) return;
  const timer = setTimeout(async () => {
    graceTimers.delete(channel.id);
    const fresh = channel.guild.channels.cache.get(channel.id);
    const temp = await store.getTemp(channel.id);
    if (!fresh || !temp || fresh.members.has(temp.ownerId) || !humansIn(fresh).size) return;
    const successor = await pickSuccessor(fresh, temp.ownerId);
    if (!successor) return;
    await applyOwner(fresh, temp, successor.id);
    await refreshPanel(fresh);
    await sendNotice(fresh, [`${em.tvOwner} <@${successor.id}> is now the owner of this room.`]);
  }, Math.max(settings.graceSeconds, 0) * 1000);
  graceTimers.set(channel.id, timer);
}

async function handleVoiceState(oldState, newState) {
  if (oldState.channelId === newState.channelId) return;
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  if (newState.channelId) {
    const lobby = await store.getLobby(newState.channelId);
    if (lobby && newState.channel) {
      await createFor(member, newState.channel, lobby);
    } else {
      const temp = await store.getTemp(newState.channelId);
      if (temp && temp.ownerId === member.id) clearGrace(temp.channelId);
    }
  }

  if (!oldState.channelId) return;
  const temp = await store.getTemp(oldState.channelId);
  if (!temp) return;
  const channel = oldState.guild.channels.cache.get(oldState.channelId);
  if (!channel) return;
  if (!humansIn(channel).size) {
    const settings = await store.getSettings(oldState.guild.id);
    await removeChannel(oldState.guild, channel.id, 'Temp voice: room is empty');
    await logEvent(oldState.guild, settings, [`${em.tvDelete} **${channel.name}** was deleted (empty)`]);
    return;
  }
  if (temp.ownerId === member.id) await startGrace(channel);
}

async function sweep(client) {
  const rows = await prisma.tempVoiceChannel.findMany();
  for (const row of rows) {
    const guild = client.guilds.cache.get(row.guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(row.channelId);
    if (!channel) {
      await store.removeTemp(row.channelId);
      continue;
    }
    if (!humansIn(channel).size) {
      await removeChannel(guild, channel.id, 'Temp voice: empty after restart');
      continue;
    }
    if (!channel.members.has(row.ownerId)) await startGrace(channel);
  }
}

async function onChannelDelete(channel) {
  if (!channel.guild) return;
  clearGrace(channel.id);
  await store.removeTemp(channel.id).catch(() => {});
  const lobby = await store.getLobby(channel.id).catch(() => null);
  if (lobby) await store.removeLobby(lobby.id);
}

async function protectedReason(guild, target, ownerId) {
  if (target.id === guild.client.user.id) return 'I cannot do that to myself.';
  if (target.id === ownerId) return 'You cannot do that to the room owner.';
  if (target.id === guild.ownerId) return 'You cannot do that to the server owner.';
  if (target.permissions.has(P.Administrator) || target.permissions.has(P.ManageChannels)) return 'That member is staff and cannot be restricted.';
  if (await isUserTrusted(guild, target.id, 'moderation')) return 'That member is on the security trust list.';
  return null;
}

async function resolveMember(guild, userId) {
  return guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
}

async function context(guild, channelId, actorId) {
  const channel = guild.channels.cache.get(channelId);
  const temp = channel ? await store.getTemp(channelId) : null;
  if (!channel || !temp) return { error: 'That is not a temporary room.' };
  const lobby = await store.getLobbyById(temp.lobbyId);
  const actor = await resolveMember(guild, actorId);
  if (!actor) return { error: 'I could not find you in this server.' };
  const staff = actor.permissions.has(P.Administrator) || actor.permissions.has(P.ManageChannels);
  return { channel, temp, lobby, actor, staff, owner: temp.ownerId === actorId, guild };
}

function needOwner(ctx) {
  if (ctx.lobby && !ctx.lobby.ownerManaged) return 'This is a public room with no owner controls.';
  if (!ctx.owner && !ctx.staff) return 'Only the room owner can do that.';
  return null;
}

async function remember(ctx, data) {
  const settings = await store.getSettings(ctx.guild.id);
  if (settings.saveProfiles) await store.saveProfile(ctx.guild.id, ctx.temp.ownerId, data);
}

async function profileOf(ctx) {
  return (await store.getProfile(ctx.guild.id, ctx.temp.ownerId)) || { trusted: [], blocked: [] };
}

const actions = {
  async rename(ctx, name) {
    const settings = await store.getSettings(ctx.guild.id);
    const clean = sanitizeName(name, settings.allowInvites);
    if (!clean) return { ok: false, error: 'That name is empty after removing links, invites and mentions.' };
    await ctx.channel.setName(clean, `Renamed by ${ctx.actor.user.tag}`).catch(() => null);
    await remember(ctx, { name: clean });
    return { ok: true, text: `Room renamed to **${clean}**.` };
  },

  async limit(ctx, number) {
    const value = Math.floor(Number(number));
    if (!Number.isFinite(value) || value < 0 || value > 99) return { ok: false, error: 'Enter a number from 0 to 99.' };
    await ctx.channel.setUserLimit(value, `Limit by ${ctx.actor.user.tag}`).catch(() => null);
    await remember(ctx, { userLimit: value });
    return { ok: true, text: value ? `User limit set to **${value}**.` : 'User limit removed.' };
  },

  async bitrate(ctx, kbps) {
    const max = Math.floor(ctx.guild.maximumBitrate / 1000);
    const value = Math.floor(Number(kbps));
    if (!Number.isFinite(value) || value < 8 || value > max) return { ok: false, error: `Bitrate must be between 8 and ${max} kbps.` };
    await ctx.channel.setBitrate(value * 1000, `Bitrate by ${ctx.actor.user.tag}`).catch(() => null);
    await remember(ctx, { bitrate: value * 1000 });
    return { ok: true, text: `Bitrate set to **${value} kbps**.` };
  },

  async lock(ctx, state) {
    const everyone = ctx.guild.roles.everyone;
    const current = ctx.channel.permissionOverwrites.cache.get(everyone.id);
    const locked = current ? current.deny.has(P.Connect) : false;
    const next = state === undefined ? !locked : state;
    await ctx.channel.permissionOverwrites.edit(everyone, { Connect: next ? false : null }, { reason: `Lock by ${ctx.actor.user.tag}` }).catch(() => null);
    await remember(ctx, { locked: next });
    return { ok: true, text: next ? 'Room locked. Only permitted members can join.' : 'Room unlocked.' };
  },

  async hide(ctx, state) {
    const everyone = ctx.guild.roles.everyone;
    const current = ctx.channel.permissionOverwrites.cache.get(everyone.id);
    const hidden = current ? current.deny.has(P.ViewChannel) : false;
    const next = state === undefined ? !hidden : state;
    await ctx.channel.permissionOverwrites.edit(everyone, { ViewChannel: next ? false : null }, { reason: `Hide by ${ctx.actor.user.tag}` }).catch(() => null);
    await remember(ctx, { hidden: next });
    return { ok: true, text: next ? 'Room hidden from everyone else.' : 'Room is visible again.' };
  },

  async permit(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member) return { ok: false, error: 'That member is not in the server.' };
    await ctx.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true }, { reason: `Permit by ${ctx.actor.user.tag}` }).catch(() => null);
    return { ok: true, text: `<@${member.id}> can now join this room.` };
  },

  async reject(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member) return { ok: false, error: 'That member is not in the server.' };
    const guard = await protectedReason(ctx.guild, member, ctx.temp.ownerId);
    if (guard) return { ok: false, error: guard };
    await ctx.channel.permissionOverwrites.edit(member.id, { ViewChannel: false, Connect: false }, { reason: `Reject by ${ctx.actor.user.tag}` }).catch(() => null);
    if (member.voice.channelId === ctx.channel.id) await member.voice.disconnect('Rejected from temp room').catch(() => {});
    return { ok: true, text: `<@${member.id}> can no longer join this room.` };
  },

  async kick(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member || member.voice.channelId !== ctx.channel.id) return { ok: false, error: 'That member is not in your room.' };
    const guard = await protectedReason(ctx.guild, member, ctx.temp.ownerId);
    if (guard) return { ok: false, error: guard };
    await member.voice.disconnect(`Kicked by ${ctx.actor.user.tag}`).catch(() => null);
    return { ok: true, text: `<@${member.id}> was removed from the room.` };
  },

  async trust(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member || member.user.bot) return { ok: false, error: 'Pick a real member of this server.' };
    const profile = await profileOf(ctx);
    if (!profile.trusted.includes(member.id) && profile.trusted.length >= MAX_LIST) return { ok: false, error: `You can trust up to ${MAX_LIST} members.` };
    await ctx.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true }, { reason: `Trust by ${ctx.actor.user.tag}` }).catch(() => null);
    await remember(ctx, { trusted: [...new Set([...profile.trusted, member.id])], blocked: profile.blocked.filter(id => id !== member.id) });
    return { ok: true, text: `<@${member.id}> is trusted and can always join your rooms.` };
  },

  async untrust(ctx, userId) {
    const profile = await profileOf(ctx);
    await ctx.channel.permissionOverwrites.delete(userId).catch(() => {});
    await remember(ctx, { trusted: profile.trusted.filter(id => id !== userId) });
    return { ok: true, text: `<@${userId}> is no longer trusted.` };
  },

  async block(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member) return { ok: false, error: 'That member is not in the server.' };
    const guard = await protectedReason(ctx.guild, member, ctx.temp.ownerId);
    if (guard) return { ok: false, error: guard };
    const profile = await profileOf(ctx);
    if (!profile.blocked.includes(member.id) && profile.blocked.length >= MAX_LIST) return { ok: false, error: `You can block up to ${MAX_LIST} members.` };
    await ctx.channel.permissionOverwrites.edit(member.id, { ViewChannel: false, Connect: false }, { reason: `Block by ${ctx.actor.user.tag}` }).catch(() => null);
    if (member.voice.channelId === ctx.channel.id) await member.voice.disconnect('Blocked from temp room').catch(() => {});
    await remember(ctx, { blocked: [...new Set([...profile.blocked, member.id])], trusted: profile.trusted.filter(id => id !== member.id) });
    return { ok: true, text: `<@${member.id}> is blocked from all of your rooms.` };
  },

  async unblock(ctx, userId) {
    const profile = await profileOf(ctx);
    await ctx.channel.permissionOverwrites.delete(userId).catch(() => {});
    await remember(ctx, { blocked: profile.blocked.filter(id => id !== userId) });
    return { ok: true, text: `<@${userId}> is unblocked.` };
  },

  async transfer(ctx, userId) {
    const member = await resolveMember(ctx.guild, userId);
    if (!member || member.user.bot) return { ok: false, error: 'Pick a real member.' };
    if (member.id === ctx.temp.ownerId) return { ok: false, error: 'They already own this room.' };
    if (member.voice.channelId !== ctx.channel.id) return { ok: false, error: 'They need to be in the room.' };
    if (await store.ownedBy(ctx.guild.id, member.id)) return { ok: false, error: 'They already own another room.' };
    const settings = await store.getSettings(ctx.guild.id);
    await logEvent(ctx.guild, settings, [`${em.tvTransfer} **${ctx.channel.name}** moved from <@${ctx.temp.ownerId}> to <@${member.id}>`]);
    await applyOwner(ctx.channel, ctx.temp, member.id);
    return { ok: true, text: `<@${member.id}> is now the owner.`, notice: `${em.tvOwner} <@${member.id}> is now the owner of this room.` };
  },

  async claim(ctx) {
    if (ctx.owner) return { ok: false, error: 'You already own this room.' };
    if (ctx.actor.voice.channelId !== ctx.channel.id) return { ok: false, error: 'Join the room first.' };
    if (ctx.lobby && !ctx.lobby.ownerManaged) return { ok: false, error: 'This is a public room with no owner.' };
    if (ctx.channel.members.has(ctx.temp.ownerId) && !ctx.staff) return { ok: false, error: 'The owner is still here.' };
    if (await store.ownedBy(ctx.guild.id, ctx.actor.id)) return { ok: false, error: 'You already own another room.' };
    clearGrace(ctx.channel.id);
    await applyOwner(ctx.channel, ctx.temp, ctx.actor.id);
    return { ok: true, text: 'You are now the owner of this room.', notice: `${em.tvClaim} <@${ctx.actor.id}> claimed this room.` };
  },

  async remove(ctx) {
    const settings = await store.getSettings(ctx.guild.id);
    await logEvent(ctx.guild, settings, [`${em.tvDelete} **${ctx.channel.name}** was deleted by <@${ctx.actor.id}>`]);
    await removeChannel(ctx.guild, ctx.channel.id, `Deleted by ${ctx.actor.user.tag}`);
    return { ok: true, text: 'Room deleted.' };
  }
};

const OWNER_ONLY = new Set(['rename', 'limit', 'bitrate', 'lock', 'hide', 'permit', 'reject', 'kick', 'trust', 'untrust', 'block', 'unblock', 'transfer', 'remove']);

async function run(guild, channelId, actorId, action, arg) {
  const ctx = await context(guild, channelId, actorId);
  if (ctx.error) return { ok: false, error: ctx.error };
  if (OWNER_ONLY.has(action)) {
    const denied = needOwner(ctx);
    if (denied) return { ok: false, error: denied };
  }
  const result = await actions[action](ctx, arg);
  if (result.ok && action !== 'remove') await refreshPanel(ctx.channel);
  if (result.notice) await sendNotice(ctx.channel, [result.notice]);
  return result;
}

async function currentRoom(guild, userId) {
  const member = await resolveMember(guild, userId);
  const channel = member && member.voice.channel;
  if (!channel) return null;
  const temp = await store.getTemp(channel.id);
  return temp ? channel : null;
}

module.exports = { handleVoiceState, sweep, onChannelDelete, run, context, createFor, refreshPanel, humansIn, removeChannel, currentRoom, resolveMember, OWNER_PERMS };
