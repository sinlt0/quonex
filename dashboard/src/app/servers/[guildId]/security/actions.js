'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '../../../../lib/db';
import { notifySecurityAction } from '../../../../lib/botApi';
import {
  requireSecurity,
  saveChanges,
  resetModule,
  applyPresetByName,
  isSnowflake,
  MAX_EXTRA_OWNERS,
  MAX_WHITELIST_ENTRIES,
  WHITELIST_MODULES,
  NUKE_EVENTS
} from '../../../../lib/securityServer';

const MODULES = ['core', 'antinuke', 'antiraid', 'automod', 'verification', 'lockdown'];
const KINDS = ['user', 'role', 'channel'];
const DENIED = { ok: false, error: 'Only the server owner or an extra owner can do that.' };

function refresh(guildId) {
  revalidatePath(`/servers/${guildId}/security`, 'layout');
}

export async function saveConfigAction(guildId, module, changes) {
  if (!MODULES.includes(module)) return { ok: false, error: 'Unknown module.' };
  const access = await requireSecurity(guildId, 'config');
  if (!access) return DENIED;
  if (!changes || typeof changes !== 'object') return { ok: false, error: 'Nothing to save.' };
  const result = await saveChanges(guildId, module, changes);
  if (result.ok) refresh(guildId);
  return result;
}

export async function toggleModuleAction(guildId, module, enabled) {
  if (!['antinuke', 'antiraid', 'automod', 'verification'].includes(module)) return { ok: false, error: 'Unknown module.' };
  return saveConfigAction(guildId, module, { enabled: Boolean(enabled) });
}

export async function resetModuleAction(guildId, module) {
  if (!MODULES.includes(module)) return { ok: false, error: 'Unknown module.' };
  const access = await requireSecurity(guildId, 'config');
  if (!access) return DENIED;
  await resetModule(guildId, module);
  refresh(guildId);
  return { ok: true };
}

export async function applyPresetAction(guildId, name) {
  const access = await requireSecurity(guildId, 'config');
  if (!access) return DENIED;
  const result = await applyPresetByName(guildId, name);
  if (result.ok) refresh(guildId);
  return result;
}

export async function addOwnerAction(guildId, prevState, formData) {
  const access = await requireSecurity(guildId, 'owner');
  if (!access) return { ok: false, error: 'Only the server owner can add extra owners.' };

  const userId = formData.get('userId')?.toString().trim();
  if (!isSnowflake(userId)) return { ok: false, error: 'Enter a valid Discord user ID.' };
  if (userId === access.session.user.id) return { ok: false, error: 'You already have full access as the owner.' };

  const count = await prisma.securityOwner.count({ where: { guildId } });
  if (count >= MAX_EXTRA_OWNERS) return { ok: false, error: `You can have at most ${MAX_EXTRA_OWNERS} extra owners.` };
  const exists = await prisma.securityOwner.findUnique({ where: { guildId_userId: { guildId, userId } } });
  if (exists) return { ok: false, error: 'They are already an extra owner.' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.securityOwner.create({ data: { guildId, userId, addedBy: access.session.user.id } });
  await prisma.securityLog.create({ data: { guildId, module: 'core', action: 'extra owner added from the dashboard', severity: 'critical', executorId: access.session.user.id, targetId: userId } });
  refresh(guildId);
  return { ok: true, error: null };
}

export async function removeOwnerAction(guildId, userId) {
  const access = await requireSecurity(guildId, 'owner');
  if (!access) return;
  await prisma.securityOwner.deleteMany({ where: { guildId, userId } });
  await prisma.securityLog.create({ data: { guildId, module: 'core', action: 'extra owner removed from the dashboard', severity: 'warning', executorId: access.session.user.id, targetId: userId } });
  refresh(guildId);
}

export async function saveWhitelistAction(guildId, entry) {
  const access = await requireSecurity(guildId, 'trusted');
  if (!access) return { ok: false, error: 'Only the server owner or an extra owner can change the whitelist.' };

  const kind = entry?.kind;
  const targetId = String(entry?.targetId || '').trim();
  if (!KINDS.includes(kind) || !isSnowflake(targetId)) return { ok: false, error: 'Pick a valid target.' };

  const modules = Array.isArray(entry.modules) ? entry.modules.filter(item => WHITELIST_MODULES.includes(item)) : [];
  if (!modules.length) return { ok: false, error: 'Pick at least one module, or everything.' };
  const finalModules = modules.includes('all') ? ['all'] : [...new Set(modules)];
  const events = Array.isArray(entry.events) ? entry.events.filter(item => NUKE_EVENTS.some(event => event.id === item)) : [];
  const finalEvents = finalModules.includes('all') || !finalModules.includes('antinuke') ? [] : [...new Set(events)];

  const existing = await prisma.securityWhitelist.findUnique({ where: { guildId_targetId_kind: { guildId, targetId, kind } } });
  if (!existing) {
    const count = await prisma.securityWhitelist.count({ where: { guildId } });
    if (count >= MAX_WHITELIST_ENTRIES) return { ok: false, error: `The whitelist is full (${MAX_WHITELIST_ENTRIES} entries).` };
  }

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.securityWhitelist.upsert({
    where: { guildId_targetId_kind: { guildId, targetId, kind } },
    update: { modules: finalModules, events: finalEvents, addedBy: access.session.user.id },
    create: { guildId, targetId, kind, modules: finalModules, events: finalEvents, addedBy: access.session.user.id }
  });
  await prisma.securityLog.create({
    data: { guildId, module: 'core', action: 'whitelist entry saved from the dashboard', severity: 'warning', executorId: access.session.user.id, targetId: kind === 'user' ? targetId : null, detail: { kind, targetId, modules: finalModules, events: finalEvents } }
  });
  refresh(guildId);
  return { ok: true, error: null };
}

export async function removeWhitelistAction(guildId, kind, targetId) {
  const access = await requireSecurity(guildId, 'trusted');
  if (!access) return;
  await prisma.securityWhitelist.deleteMany({ where: { guildId, kind, targetId } });
  await prisma.securityLog.create({ data: { guildId, module: 'core', action: 'whitelist entry removed from the dashboard', executorId: access.session.user.id, targetId: kind === 'user' ? targetId : null } });
  refresh(guildId);
}

const BOT_ACTIONS = new Set(['panic-start', 'panic-end', 'lockdown-start', 'lockdown-end', 'raid-start', 'raid-end', 'backup-create', 'backup-restore', 'verification-panel']);
const ERRORS = {
  'already-active': 'That is already active.',
  'not-active': 'That is not active.',
  unreachable: 'The bot did not respond. Try again in a moment.',
  'guild-missing': 'The bot is not in this server.',
  'backup-missing': 'That backup no longer exists.',
  'channel-missing': 'Pick a text channel the bot can see.',
  'send-failed': 'The bot could not post there. Check its permissions.'
};

export async function runBotSecurityAction(guildId, action, params = {}) {
  if (!BOT_ACTIONS.has(action)) return { ok: false, error: 'Unknown action.' };
  const access = await requireSecurity(guildId, 'config');
  if (!access) return DENIED;

  const body = { guildId, action, by: access.session.user.id };
  if (params.minutes) body.minutes = Math.min(Math.max(Number.parseInt(params.minutes, 10) || 0, 0), 10080);
  if (params.name) body.name = String(params.name).slice(0, 60);
  if (params.backupId) body.backupId = String(params.backupId);
  if (params.channelId) body.channelId = String(params.channelId);
  if (typeof params.roles === 'boolean') body.roles = params.roles;
  if (typeof params.channels === 'boolean') body.channels = params.channels;

  const result = await notifySecurityAction(body);
  refresh(guildId);
  if (!result.ok) {
    const code = result.data?.error;
    return { ok: false, error: ERRORS[code] || ERRORS.unreachable };
  }
  return { ok: true, error: null, data: result.data };
}

export async function deleteBackupAction(guildId, backupId) {
  const access = await requireSecurity(guildId, 'config');
  if (!access) return;
  await prisma.securityBackup.deleteMany({ where: { id: backupId, guildId } });
  refresh(guildId);
}
