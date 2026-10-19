const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v2Message } = require('../components');
const { loadConfig, isUserTrusted, writeLog, addTimer, cancelTimer } = require('../security/store');
const { securityLog } = require('../security/alerts');
const { recordModAction } = require('../security/antinuke');
const { myTop } = require('../security/punish');
const { createCase, activeWarns } = require('./cases');
const { formatDuration } = require('./duration');
const { em } = require('../emojis');

const TIMEOUT_MAX_MINUTES = 28 * 24 * 60;

const LABELS = {
  ban: 'Ban',
  tempban: 'Temporary ban',
  softban: 'Softban',
  unban: 'Unban',
  kick: 'Kick',
  timeout: 'Timeout',
  untimeout: 'Timeout removed',
  warn: 'Warning',
  quarantine: 'Quarantine',
  massban: 'Ban'
};

const ICONS = {
  ban: em.modBan,
  tempban: em.modBan,
  softban: em.modBan,
  massban: em.modBan,
  unban: em.modUnban,
  kick: em.modKick,
  timeout: em.modTimeout,
  untimeout: em.modTimeout,
  warn: em.modWarn,
  quarantine: em.modAuto
};

const EVENTS = { ban: 'memberBan', tempban: 'memberBan', softban: 'memberBan', massban: 'memberBan', kick: 'memberKick', timeout: 'memberTimeout' };

function botModerator(guild) {
  return { id: guild.client.user.id, auto: true, tag: guild.client.user.tag };
}

function tagOf(moderator) {
  return moderator.user ? moderator.user.tag : moderator.tag;
}

function reasonOf(config, reason) {
  const text = reason && String(reason).trim();
  return text ? text.slice(0, 450) : config.defaultReason;
}

function auditReason(moderator, reason) {
  return `${tagOf(moderator)}: ${reason}`.slice(0, 480);
}

async function prepare(guild, userId) {
  const user = await guild.client.users.fetch(userId).catch(() => null);
  if (!user) return { error: 'I could not find that user.' };
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  return { user, member };
}

async function checkTarget({ guild, config, moderator, user, member, action }) {
  const auto = Boolean(moderator.auto);
  if (!auto && user.id === moderator.id) return `You cannot ${action} yourself.`;
  if (user.id === guild.client.user.id) return 'I cannot do that to myself.';
  if (user.id === guild.ownerId) return 'The server owner cannot be moderated.';

  if (config.protectTrusted && (await isUserTrusted(guild, user.id, 'moderation'))) {
    return 'That member is protected by the security trust list (owner, extra owner or whitelist).';
  }
  if (member && config.immuneRoleIds.some(id => member.roles.cache.has(id))) return 'That member has an immune role.';

  if (member) {
    if (!auto && moderator.id !== guild.ownerId && member.roles.highest.position >= moderator.roles.highest.position) {
      return 'Their highest role is equal to or above yours.';
    }
    if (member.roles.highest.position >= myTop(guild)) return 'Their highest role is above mine. Move my role higher.';
  }
  return null;
}

async function notify(guild, user, config, { action, reason, minutes, appeal }) {
  if (!config.dmOnAction) return false;
  const verbs = { ban: 'banned from', tempban: 'banned from', softban: 'removed from', kick: 'kicked from', timeout: 'timed out in', warn: 'warned in', massban: 'banned from' };
  const lines = [`${ICONS[action] || ''} You were ${verbs[action] || 'moderated in'} **${guild.name}**.`, `**Reason:** ${reason}`];
  if (minutes && ['tempban', 'timeout'].includes(action)) lines.push(`**Length:** ${formatDuration(minutes)}`);
  if (appeal && config.appealText && ['ban', 'tempban', 'kick', 'massban'].includes(action)) lines.push(config.appealText);
  const options = { footer: false };
  if (appeal && config.appealsEnabled && ['ban', 'tempban', 'massban'].includes(action)) {
    options.extraComponents = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ap:start:${guild.id}`).setLabel('Appeal this ban').setStyle(ButtonStyle.Secondary))];
  }
  await user.send(v2Message(lines, options)).catch(() => {});
  return true;
}

async function logCase(guild, config, row) {
  const label = LABELS[row.action] || row.action;
  const lines = [`### ${ICONS[row.action] || em.modCase} Case #${row.caseNumber} · ${label}${row.auto ? ' (automatic)' : ''}`, `**User:** <@${row.userId}> (\`${row.userId}\`)`, `**Moderator:** <@${row.moderatorId}>`];
  if (row.duration) lines.push(`**Length:** ${formatDuration(row.duration)}`);
  lines.push(`**Reason:** ${row.reason || config.defaultReason}`);

  const channel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
  if (channel && channel.isTextBased()) {
    await writeLog({ guildId: guild.id, module: 'moderation', action: `case #${row.caseNumber}: ${label.toLowerCase()}`, executorId: row.moderatorId, targetId: row.userId, detail: { reason: row.reason, duration: row.duration, auto: row.auto } }).catch(() => {});
    await channel.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
    return;
  }

  await securityLog(guild, {
    module: 'moderation',
    action: `case #${row.caseNumber}: ${label.toLowerCase()}`,
    executorId: row.moderatorId,
    targetId: row.userId,
    detail: { reason: row.reason, duration: row.duration, auto: row.auto },
    lines: [row.duration ? `Length: ${formatDuration(row.duration)}` : null, `Reason: ${row.reason || config.defaultReason}`].filter(Boolean)
  });
}

async function finish({ guild, config, moderator, user, action, reason, minutes = null, expiresAt = null }) {
  const row = await createCase({ guildId: guild.id, userId: user.id, moderatorId: moderator.id, action, reason, duration: minutes, auto: Boolean(moderator.auto), expiresAt });
  await logCase(guild, config, row);

  const event = EVENTS[action];
  if (event && config.countTowardAntiNuke && !moderator.auto) {
    await recordModAction(guild, moderator.id, event, user.id).catch(error => console.error('Moderator rate check failed:', error));
  }
  return row;
}

async function banUser({ guild, moderator, userId, reason, minutes = null, deleteDays, silent = false }) {
  const config = (await loadConfig(guild.id)).moderation;
  const prepared = await prepare(guild, userId);
  if (prepared.error) return { ok: false, error: prepared.error };
  const { user, member } = prepared;

  const blocked = await checkTarget({ guild, config, moderator, user, member, action: 'ban', });
  if (blocked) return { ok: false, error: blocked };

  const text = reasonOf(config, reason);
  const action = minutes ? 'tempban' : 'ban';
  if (member && !silent) await notify(guild, user, config, { action, reason: text, minutes, appeal: true });

  const days = Math.min(Math.max(deleteDays ?? config.defaultBanDeleteDays, 0), 7);
  try {
    await guild.members.ban(user.id, { reason: auditReason(moderator, text), deleteMessageSeconds: days * 86400 });
  } catch (error) {
    return { ok: false, error: 'Discord refused the ban. Check my permissions and role position.' };
  }

  let expiresAt = null;
  if (minutes) {
    expiresAt = new Date(Date.now() + minutes * 60000);
    await addTimer({ guildId: guild.id, kind: 'unban', targetId: user.id, expiresAt });
  } else {
    await cancelTimer(guild.id, 'unban', user.id);
  }

  const row = await finish({ guild, config, moderator, user, action, reason: text, minutes, expiresAt });
  return { ok: true, row, user };
}

async function softbanUser({ guild, moderator, userId, reason, deleteDays = 1 }) {
  const config = (await loadConfig(guild.id)).moderation;
  const prepared = await prepare(guild, userId);
  if (prepared.error) return { ok: false, error: prepared.error };
  const { user, member } = prepared;
  if (!member) return { ok: false, error: 'Softban only works on members who are in the server.' };

  const blocked = await checkTarget({ guild, config, moderator, user, member, action: 'softban' });
  if (blocked) return { ok: false, error: blocked };

  const text = reasonOf(config, reason);
  await notify(guild, user, config, { action: 'softban', reason: text, appeal: false });
  try {
    await guild.members.ban(user.id, { reason: auditReason(moderator, `Softban: ${text}`), deleteMessageSeconds: Math.min(Math.max(deleteDays, 1), 7) * 86400 });
    await guild.members.unban(user.id, auditReason(moderator, 'Softban: removing the ban'));
  } catch {
    return { ok: false, error: 'Discord refused the softban. Check my permissions and role position.' };
  }

  const row = await finish({ guild, config, moderator, user, action: 'softban', reason: text });
  return { ok: true, row, user };
}

async function unbanUser({ guild, moderator, userId, reason }) {
  const config = (await loadConfig(guild.id)).moderation;
  const ban = await guild.bans.fetch(userId).catch(() => null);
  if (!ban) return { ok: false, error: 'That user is not banned.' };

  const text = reasonOf(config, reason);
  try {
    await guild.members.unban(userId, auditReason(moderator, text));
  } catch {
    return { ok: false, error: 'Discord refused the unban.' };
  }
  await cancelTimer(guild.id, 'unban', userId);
  const row = await finish({ guild, config, moderator, user: ban.user, action: 'unban', reason: text });
  return { ok: true, row, user: ban.user };
}

async function kickUser({ guild, moderator, userId, reason, silent = false }) {
  const config = (await loadConfig(guild.id)).moderation;
  const prepared = await prepare(guild, userId);
  if (prepared.error) return { ok: false, error: prepared.error };
  const { user, member } = prepared;
  if (!member) return { ok: false, error: 'That member is not in the server.' };

  const blocked = await checkTarget({ guild, config, moderator, user, member, action: 'kick' });
  if (blocked) return { ok: false, error: blocked };

  const text = reasonOf(config, reason);
  if (!silent) await notify(guild, user, config, { action: 'kick', reason: text, appeal: true });
  try {
    await member.kick(auditReason(moderator, text));
  } catch {
    return { ok: false, error: 'Discord refused the kick. Check my permissions and role position.' };
  }
  const row = await finish({ guild, config, moderator, user, action: 'kick', reason: text });
  return { ok: true, row, user };
}

async function timeoutUser({ guild, moderator, userId, minutes, reason }) {
  const config = (await loadConfig(guild.id)).moderation;
  const prepared = await prepare(guild, userId);
  if (prepared.error) return { ok: false, error: prepared.error };
  const { user, member } = prepared;
  if (!member) return { ok: false, error: 'That member is not in the server.' };

  const blocked = await checkTarget({ guild, config, moderator, user, member, action: 'timeout' });
  if (blocked) return { ok: false, error: blocked };

  const length = Math.min(Math.max(minutes, 1), TIMEOUT_MAX_MINUTES);
  const text = reasonOf(config, reason);
  try {
    await member.timeout(length * 60000, auditReason(moderator, text));
  } catch {
    return { ok: false, error: 'Discord refused the timeout. Check my permissions and role position.' };
  }
  await notify(guild, user, config, { action: 'timeout', reason: text, minutes: length });
  const row = await finish({ guild, config, moderator, user, action: 'timeout', reason: text, minutes: length, expiresAt: new Date(Date.now() + length * 60000) });
  return { ok: true, row, user, minutes: length };
}

async function untimeoutUser({ guild, moderator, userId, reason }) {
  const config = (await loadConfig(guild.id)).moderation;
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  if (!member) return { ok: false, error: 'That member is not in the server.' };
  if (!member.isCommunicationDisabled()) return { ok: false, error: 'That member is not timed out.' };

  const text = reasonOf(config, reason);
  try {
    await member.timeout(null, auditReason(moderator, text));
  } catch {
    return { ok: false, error: 'Discord refused that. Check my permissions and role position.' };
  }
  const row = await finish({ guild, config, moderator, user: member.user, action: 'untimeout', reason: text });
  return { ok: true, row, user: member.user };
}

async function escalate(guild, config, user, count) {
  const bot = botModerator(guild);
  const reason = `Reached ${count} active warnings`;
  if (config.warnBanAt && count === config.warnBanAt) return banUser({ guild, moderator: bot, userId: user.id, reason, silent: false });
  if (config.warnKickAt && count === config.warnKickAt) return kickUser({ guild, moderator: bot, userId: user.id, reason });
  if (config.warnTimeoutAt && count === config.warnTimeoutAt) return timeoutUser({ guild, moderator: bot, userId: user.id, minutes: config.warnTimeoutMinutes, reason });
  return null;
}

async function warnUser({ guild, moderator, userId, reason }) {
  const config = (await loadConfig(guild.id)).moderation;
  const prepared = await prepare(guild, userId);
  if (prepared.error) return { ok: false, error: prepared.error };
  const { user, member } = prepared;
  if (!member) return { ok: false, error: 'That member is not in the server.' };

  const blocked = await checkTarget({ guild, config, moderator, user, member, action: 'warn' });
  if (blocked) return { ok: false, error: blocked };

  const text = reasonOf(config, reason);
  const expiresAt = config.warnExpireDays ? new Date(Date.now() + config.warnExpireDays * 86400000) : null;
  await notify(guild, user, config, { action: 'warn', reason: text });
  const row = await finish({ guild, config, moderator, user, action: 'warn', reason: text, expiresAt });
  const count = (await activeWarns(guild.id, user.id)).length;
  const escalation = await escalate(guild, config, user, count);
  return { ok: true, row, user, count, escalation };
}

module.exports = { banUser, softbanUser, unbanUser, kickUser, timeoutUser, untimeoutUser, warnUser, finish, prepare, checkTarget, reasonOf, LABELS, ICONS, TIMEOUT_MAX_MINUTES };
