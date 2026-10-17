const prisma = require('../db');
const { DEFAULTS, findEntry, keysFor, MAX_EXTRA_OWNERS, MAX_WHITELIST_ENTRIES } = require('../../config/security');
const { coerceStored, parseBool, extractId, parseValue, parseListItem } = require('./values');

const CACHE_MS = 20 * 1000;
const configCache = new Map();
const whitelistCache = new Map();
const ownerCache = new Map();

const SNOWFLAKE = /^\d{15,25}$/;

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

async function loadConfig(guildId) {
  const cached = configCache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const row = await prisma.securitySettings.findUnique({ where: { guildId } });
  const stored = row && row.config && typeof row.config === 'object' ? row.config : {};
  const merged = cloneDefaults();

  for (const module of Object.keys(merged)) {
    const storedModule = stored[module] && typeof stored[module] === 'object' ? stored[module] : {};
    for (const entry of keysFor(module)) {
      if (Object.prototype.hasOwnProperty.call(storedModule, entry.key)) {
        merged[module][entry.key] = coerceStored(entry, storedModule[entry.key]);
      }
    }
  }

  configCache.set(guildId, { value: merged, expires: Date.now() + CACHE_MS });
  return merged;
}

function invalidate(guildId) {
  configCache.delete(guildId);
  whitelistCache.delete(guildId);
  ownerCache.delete(guildId);
}

async function readStored(guildId) {
  const row = await prisma.securitySettings.findUnique({ where: { guildId } });
  return row && row.config && typeof row.config === 'object' ? JSON.parse(JSON.stringify(row.config)) : {};
}

async function writeStored(guildId, stored) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.securitySettings.upsert({ where: { guildId }, update: { config: stored }, create: { guildId, config: stored } });
  invalidate(guildId);
}

async function setValue(guildId, module, key, raw) {
  const entry = findEntry(module, key);
  if (!entry) return { ok: false, error: 'unknown-key' };

  const stored = await readStored(guildId);
  stored[module] = stored[module] || {};

  if (['list', 'rolelist', 'userlist'].includes(entry.type)) {
    const items = String(raw)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const parsed = items.map(item => parseListItem(entry, item));
    if (parsed.some(item => !item.ok)) return { ok: false, error: 'invalid-value' };
    stored[module][key] = [...new Set(parsed.map(item => item.value))].slice(0, 100);
    await writeStored(guildId, stored);
    return { ok: true, entry, value: stored[module][key] };
  }

  const parsed = parseValue(entry, raw);
  if (!parsed.ok) return { ok: false, error: 'invalid-value', entry, range: parsed.range };

  stored[module][key] = parsed.value;
  await writeStored(guildId, stored);
  return { ok: true, entry, value: parsed.value };
}

async function setRaw(guildId, module, key, value) {
  const entry = findEntry(module, key);
  if (!entry) return { ok: false, error: 'unknown-key' };
  const stored = await readStored(guildId);
  stored[module] = stored[module] || {};
  stored[module][key] = value;
  await writeStored(guildId, stored);
  return { ok: true };
}

async function mutateList(guildId, module, key, raw, add) {
  const entry = findEntry(module, key);
  if (!entry) return { ok: false, error: 'unknown-key' };
  if (!['list', 'rolelist', 'userlist'].includes(entry.type)) return { ok: false, error: 'not-list' };

  const parsed = parseListItem(entry, raw);
  if (!parsed.ok) return { ok: false, error: 'invalid-value' };

  const config = await loadConfig(guildId);
  const current = config[module][key];
  const next = add ? [...new Set([...current, parsed.value])].slice(0, 100) : current.filter(item => item !== parsed.value);

  const stored = await readStored(guildId);
  stored[module] = stored[module] || {};
  stored[module][key] = next;
  await writeStored(guildId, stored);
  return { ok: true, entry, value: next, item: parsed.value };
}

async function resetConfig(guildId, module, key) {
  const stored = await readStored(guildId);
  if (key) {
    if (!findEntry(module, key)) return { ok: false, error: 'unknown-key' };
    if (stored[module]) delete stored[module][key];
  } else {
    delete stored[module];
  }
  await writeStored(guildId, stored);
  return { ok: true };
}

async function applyPreset(guildId, preset) {
  const stored = await readStored(guildId);
  for (const [module, values] of Object.entries(preset)) {
    if (module === 'description') continue;
    stored[module] = stored[module] || {};
    for (const [key, value] of Object.entries(values)) {
      if (findEntry(module, key)) stored[module][key] = value;
    }
  }
  await writeStored(guildId, stored);
}

async function loadWhitelist(guildId) {
  const cached = whitelistCache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await prisma.securityWhitelist.findMany({ where: { guildId } });
  whitelistCache.set(guildId, { value, expires: Date.now() + CACHE_MS });
  return value;
}

async function loadOwners(guildId) {
  const cached = ownerCache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const rows = await prisma.securityOwner.findMany({ where: { guildId } });
  const value = new Set(rows.map(row => row.userId));
  ownerCache.set(guildId, { value, expires: Date.now() + CACHE_MS });
  return value;
}

async function addExtraOwner(guildId, userId, addedBy) {
  const owners = await loadOwners(guildId);
  if (owners.has(userId)) return { ok: false, error: 'exists' };
  if (owners.size >= MAX_EXTRA_OWNERS) return { ok: false, error: 'limit' };
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.securityOwner.create({ data: { guildId, userId, addedBy } });
  invalidate(guildId);
  return { ok: true };
}

async function removeExtraOwner(guildId, userId) {
  const result = await prisma.securityOwner.deleteMany({ where: { guildId, userId } });
  invalidate(guildId);
  return { ok: result.count > 0 };
}

async function listExtraOwners(guildId) {
  return prisma.securityOwner.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

async function addWhitelist(guildId, { targetId, kind, modules, events, addedBy }) {
  const count = await prisma.securityWhitelist.count({ where: { guildId } });
  const existing = await prisma.securityWhitelist.findUnique({ where: { guildId_targetId_kind: { guildId, targetId, kind } } });
  if (!existing && count >= MAX_WHITELIST_ENTRIES) return { ok: false, error: 'limit' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const entry = await prisma.securityWhitelist.upsert({
    where: { guildId_targetId_kind: { guildId, targetId, kind } },
    update: { modules, events, addedBy },
    create: { guildId, targetId, kind, modules, events, addedBy }
  });
  invalidate(guildId);
  return { ok: true, entry };
}

async function removeWhitelist(guildId, targetId, kind) {
  const result = await prisma.securityWhitelist.deleteMany({ where: { guildId, targetId, ...(kind ? { kind } : {}) } });
  invalidate(guildId);
  return { ok: result.count > 0 };
}

async function listWhitelist(guildId) {
  return prisma.securityWhitelist.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

function covers(entry, module, event) {
  if (!entry.modules.includes('all') && !entry.modules.includes(module)) return false;
  if (module === 'antinuke' && event && entry.events.length > 0 && !entry.events.includes(event)) return false;
  return true;
}

async function isExtraOwner(guildId, userId) {
  const owners = await loadOwners(guildId);
  return owners.has(userId);
}

async function isTrusted(guild, userId, roleIds, module, event) {
  if (guild.ownerId === userId) return true;
  if (userId === guild.client.user.id) return true;
  if (await isExtraOwner(guild.id, userId)) return true;

  const list = await loadWhitelist(guild.id);
  return list.some(entry => {
    if (!covers(entry, module, event)) return false;
    if (entry.kind === 'user') return entry.targetId === userId;
    if (entry.kind === 'role') return roleIds.includes(entry.targetId);
    return false;
  });
}

async function isMemberTrusted(member, module, event) {
  return isTrusted(member.guild, member.id, [...member.roles.cache.keys()], module, event);
}

async function isUserTrusted(guild, userId, module, event) {
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  return isTrusted(guild, userId, member ? [...member.roles.cache.keys()] : [], module, event);
}

async function isChannelExempt(guildId, channel, module) {
  const list = await loadWhitelist(guildId);
  return list.some(entry => {
    if (entry.kind !== 'channel') return false;
    if (!covers(entry, module)) return false;
    return entry.targetId === channel.id || (channel.parentId && entry.targetId === channel.parentId);
  });
}

async function writeLog({ guildId, module, action, severity = 'info', executorId = null, targetId = null, detail = null }) {
  return prisma.securityLog.create({ data: { guildId, module, action, severity, executorId, targetId, detail } });
}

async function addTimer({ guildId, kind, targetId = null, data = null, expiresAt, replace = true }) {
  if (replace && targetId) await prisma.securityTimer.deleteMany({ where: { guildId, kind, targetId } });
  return prisma.securityTimer.create({ data: { guildId, kind, targetId, data, expiresAt } });
}

async function cancelTimer(guildId, kind, targetId) {
  await prisma.securityTimer.deleteMany({ where: { guildId, kind, ...(targetId ? { targetId } : {}) } });
}

async function addStrike(guildId, userId, resetHours) {
  const existing = await prisma.securityStrike.findUnique({ where: { guildId_userId: { guildId, userId } } });
  const expired = existing && Date.now() - existing.lastAt.getTime() > resetHours * 3600 * 1000;
  const count = existing && !expired ? existing.count + 1 : 1;
  await prisma.securityStrike.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { count, lastAt: new Date() },
    create: { guildId, userId, count, lastAt: new Date() }
  });
  return count;
}

async function getStrikes(guildId, userId) {
  const row = await prisma.securityStrike.findUnique({ where: { guildId_userId: { guildId, userId } } });
  return row ? row.count : 0;
}

async function clearStrikes(guildId, userId) {
  await prisma.securityStrike.deleteMany({ where: { guildId, userId } });
}

module.exports = {
  SNOWFLAKE,
  loadConfig,
  setValue,
  setRaw,
  mutateList,
  resetConfig,
  applyPreset,
  addExtraOwner,
  removeExtraOwner,
  listExtraOwners,
  isExtraOwner,
  addWhitelist,
  removeWhitelist,
  listWhitelist,
  isTrusted,
  isMemberTrusted,
  isUserTrusted,
  isChannelExempt,
  writeLog,
  addTimer,
  cancelTimer,
  addStrike,
  getStrikes,
  clearStrikes
};
