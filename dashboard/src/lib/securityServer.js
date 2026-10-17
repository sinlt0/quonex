import { auth } from '../auth';
import { getMutualGuilds } from './discord';
import { prisma } from './db';
import { DEFAULTS, REGISTRY, PRESETS, MAX_EXTRA_OWNERS, MAX_WHITELIST_ENTRIES, WHITELIST_MODULES, NUKE_EVENTS } from '../../../src/config/security.js';
import { coerceStored, validateChange } from '../../../src/lib/security/values.js';

const ADMINISTRATOR = 0x8;
const SNOWFLAKE = /^\d{15,25}$/;

export { DEFAULTS, REGISTRY, PRESETS, MAX_EXTRA_OWNERS, MAX_WHITELIST_ENTRIES, WHITELIST_MODULES, NUKE_EVENTS };

export async function loadSecurityConfig(guildId) {
  const row = await prisma.securitySettings.findUnique({ where: { guildId } });
  const stored = row && row.config && typeof row.config === 'object' ? row.config : {};
  const merged = JSON.parse(JSON.stringify(DEFAULTS));

  for (const entry of REGISTRY) {
    const storedModule = stored[entry.module] && typeof stored[entry.module] === 'object' ? stored[entry.module] : {};
    if (Object.prototype.hasOwnProperty.call(storedModule, entry.key)) {
      merged[entry.module][entry.key] = coerceStored(entry, storedModule[entry.key]);
    }
  }
  return merged;
}

export async function getSecurityAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return { session: null, tier: null };

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return { session: null, tier: null };

  if (guild.owner) return { session, guild, tier: 'owner' };

  const extra = await prisma.securityOwner.findUnique({ where: { guildId_userId: { guildId, userId: session.user.id } } });
  if (extra) return { session, guild, tier: 'extra' };

  const config = await loadSecurityConfig(guildId);
  if (!config.core.strictAccess && (Number(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR) return { session, guild, tier: 'admin' };

  return { session, guild, tier: null };
}

export function allows(tier, level) {
  if (!tier) return false;
  if (level === 'owner') return tier === 'owner';
  if (level === 'trusted') return tier === 'owner' || tier === 'extra';
  return true;
}

export async function requireSecurity(guildId, level = 'config') {
  const access = await getSecurityAccess(guildId);
  if (!allows(access.tier, level)) return null;
  return access;
}

async function readStored(guildId) {
  const row = await prisma.securitySettings.findUnique({ where: { guildId } });
  return row && row.config && typeof row.config === 'object' ? JSON.parse(JSON.stringify(row.config)) : {};
}

async function writeStored(guildId, stored) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.securitySettings.upsert({ where: { guildId }, update: { config: stored }, create: { guildId, config: stored } });
}

export async function saveChanges(guildId, module, changes) {
  const stored = await readStored(guildId);
  stored[module] = stored[module] || {};
  const rejected = [];

  for (const [key, raw] of Object.entries(changes)) {
    const entry = REGISTRY.find(item => item.module === module && item.key === key);
    if (!entry || (module === 'verification' && key === 'panelMessageId')) {
      rejected.push(key);
      continue;
    }
    const result = validateChange(entry, raw);
    if (!result.ok) {
      rejected.push(entry.label);
      continue;
    }
    stored[module][key] = result.value;
  }

  if (rejected.length) return { ok: false, error: `Invalid value for: ${rejected.slice(0, 4).join(', ')}${rejected.length > 4 ? '…' : ''}` };
  await writeStored(guildId, stored);
  return { ok: true };
}

export async function resetModule(guildId, module) {
  const stored = await readStored(guildId);
  const keep = module === 'verification' && stored.verification ? { panelChannelId: stored.verification.panelChannelId, panelMessageId: stored.verification.panelMessageId } : null;
  delete stored[module];
  if (keep) stored.verification = Object.fromEntries(Object.entries(keep).filter(([, value]) => value));
  await writeStored(guildId, stored);
}

export async function applyPresetByName(guildId, name) {
  const preset = PRESETS[name];
  if (!preset) return { ok: false, error: 'Unknown preset.' };
  const stored = await readStored(guildId);
  for (const [module, values] of Object.entries(preset)) {
    if (module === 'description') continue;
    stored[module] = stored[module] || {};
    for (const [key, value] of Object.entries(values)) {
      if (REGISTRY.some(entry => entry.module === module && entry.key === key)) stored[module][key] = value;
    }
  }
  await writeStored(guildId, stored);
  return { ok: true };
}

export function isSnowflake(value) {
  return SNOWFLAKE.test(String(value || '').trim());
}
