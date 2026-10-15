'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { limitFor, isGuildPremium } from '../../../../lib/panelLimits';

const MAX_MESSAGE_LENGTH = 500;
const MAX_LEVEL_FOR_REWARDS = 1000;

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

async function ensureSettings(guildId) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const existing = await prisma.levelSettings.findUnique({ where: { guildId }, include: { roleRewards: true } });
  if (existing) return existing;
  return prisma.levelSettings.create({ data: { guildId }, include: { roleRewards: true } });
}

const TOGGLE_FIELDS = ['enabled', 'levelUpEnabled', 'voiceXpEnabled', 'voiceRequireOthers', 'rankCardEnabled'];

export async function updateLevelToggleAction(guildId, field, value) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!TOGGLE_FIELDS.includes(field)) return { ok: false, error: 'Unknown setting.' };

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { [field]: Boolean(value) } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function updateLevelUpChannelAction(guildId, channelId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { levelUpChannelId: channelId || null } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function updateXpSettingsAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const xpMin = Number.parseInt(formData.get('xpMin'), 10);
  const xpMax = Number.parseInt(formData.get('xpMax'), 10);
  const cooldownSeconds = Number.parseInt(formData.get('cooldownSeconds'), 10);

  if (!Number.isInteger(xpMin) || !Number.isInteger(xpMax) || xpMin < 1 || xpMax < xpMin) {
    return { ok: false, error: 'Min XP must be 1 or higher and no greater than max XP.' };
  }
  if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 3600) {
    return { ok: false, error: 'Cooldown must be between 0 and 3600 seconds.' };
  }

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { xpMin, xpMax, cooldownSeconds } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function updateLevelUpMessageAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const message = formData.get('levelUpMessage')?.toString().trim();
  if (!message) return { ok: false, error: 'Enter a message.' };
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { levelUpMessage: message } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function addIgnoredChannelAction(guildId, channelId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!channelId) return { ok: false, error: 'Pick a channel.' };

  const settings = await ensureSettings(guildId);
  if (settings.ignoredChannelIds.includes(channelId)) return { ok: true, error: null };

  await prisma.levelSettings.update({
    where: { guildId },
    data: { ignoredChannelIds: { set: [...settings.ignoredChannelIds, channelId] } }
  });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function removeIgnoredChannelAction(guildId, channelId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const settings = await ensureSettings(guildId);
  await prisma.levelSettings.update({
    where: { guildId },
    data: { ignoredChannelIds: { set: settings.ignoredChannelIds.filter(id => id !== channelId) } }
  });
  revalidatePath(`/servers/${guildId}/levels`);
}

export async function addRoleRewardAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const level = Number.parseInt(formData.get('level'), 10);
  const roleId = formData.get('roleId')?.toString();

  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL_FOR_REWARDS) {
    return { ok: false, error: `Level must be a whole number from 1 to ${MAX_LEVEL_FOR_REWARDS}.` };
  }
  if (!roleId) return { ok: false, error: 'Pick a role.' };

  const settings = await ensureSettings(guildId);
  if (settings.roleRewards.some(reward => reward.level === level)) {
    return { ok: false, error: 'This server already has a role reward at that level.' };
  }

  const limit = await limitFor(guildId, 'levelRoleRewards');
  if (settings.roleRewards.length >= limit) {
    return { ok: false, error: `Role reward limit reached (${limit}). Upgrade to premium for more.` };
  }

  await prisma.levelRoleReward.create({ data: { settingsId: settings.id, level, roleId } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function removeRoleRewardAction(guildId, rewardId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const settings = await ensureSettings(guildId);
  await prisma.levelRoleReward.deleteMany({ where: { id: rewardId, settingsId: settings.id } });
  revalidatePath(`/servers/${guildId}/levels`);
}

export async function updateVoiceXpAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const perMinute = Number.parseInt(formData.get('voiceXpPerMinute'), 10);
  if (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > 100) {
    return { ok: false, error: 'Voice XP per minute must be a whole number from 1 to 100.' };
  }

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { voiceXpPerMinute: perMinute } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function updateGlobalMultiplierAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const value = Number.parseFloat(formData.get('globalMultiplier'));
  if (!Number.isFinite(value) || value < 0.1 || value > 10) {
    return { ok: false, error: 'Multiplier must be between 0.1 and 10.' };
  }

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data: { globalMultiplier: Math.round(value * 100) / 100 } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function addMultiplierAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const type = formData.get('type')?.toString();
  const targetId = formData.get('targetId')?.toString();
  const value = Number.parseFloat(formData.get('multiplier'));

  if (type !== 'role' && type !== 'channel') return { ok: false, error: 'Pick role or channel.' };
  if (!targetId) return { ok: false, error: 'Pick a target.' };
  if (!Number.isFinite(value) || value < 0.1 || value > 10) {
    return { ok: false, error: 'Multiplier must be between 0.1 and 10.' };
  }

  const settings = await ensureSettings(guildId);
  const entries = Array.isArray(settings.xpMultipliers) ? settings.xpMultipliers : [];
  if (entries.some(entry => entry.type === type && entry.id === targetId)) {
    return { ok: false, error: 'That target already has a multiplier.' };
  }

  const limit = await limitFor(guildId, 'xpMultipliers');
  if (entries.length >= limit) {
    return { ok: false, error: `Multiplier limit reached (${limit}). Upgrade to premium for more.` };
  }

  const next = [...entries, { type, id: targetId, multiplier: Math.round(value * 100) / 100 }];
  await prisma.levelSettings.update({ where: { guildId }, data: { xpMultipliers: next } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function removeMultiplierAction(guildId, type, targetId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const settings = await ensureSettings(guildId);
  const entries = Array.isArray(settings.xpMultipliers) ? settings.xpMultipliers : [];
  const next = entries.filter(entry => !(entry.type === type && entry.id === targetId));
  await prisma.levelSettings.update({ where: { guildId }, data: { xpMultipliers: next } });
  revalidatePath(`/servers/${guildId}/levels`);
}

export async function addNoXpRoleAction(guildId, roleId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!roleId) return { ok: false, error: 'Pick a role.' };

  const settings = await ensureSettings(guildId);
  if (settings.noXpRoleIds.includes(roleId)) return { ok: true, error: null };
  if (settings.noXpRoleIds.length >= 25) return { ok: false, error: 'You can list at most 25 roles.' };

  await prisma.levelSettings.update({ where: { guildId }, data: { noXpRoleIds: { set: [...settings.noXpRoleIds, roleId] } } });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}

export async function removeNoXpRoleAction(guildId, roleId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const settings = await ensureSettings(guildId);
  await prisma.levelSettings.update({
    where: { guildId },
    data: { noXpRoleIds: { set: settings.noXpRoleIds.filter(id => id !== roleId) } }
  });
  revalidatePath(`/servers/${guildId}/levels`);
}

export async function updateRankCardAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const accent = formData.get('rankCardAccent')?.toString().trim() || '';
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return { ok: false, error: 'Use a hex color like #8b7cf6.' };

  const data = { rankCardAccent: accent };
  const background = formData.get('rankCardBackground')?.toString().trim() || '';

  if (formData.has('rankCardBackground')) {
    if (background) {
      if (!(await isGuildPremium(guildId))) return { ok: false, error: 'Custom rank card backgrounds are a premium feature.' };
      if (!/^https?:\/\//.test(background)) return { ok: false, error: 'Background must be a direct image URL.' };
      data.rankCardBackground = background;
    } else {
      data.rankCardBackground = null;
    }
  }

  await ensureSettings(guildId);
  await prisma.levelSettings.update({ where: { guildId }, data });
  revalidatePath(`/servers/${guildId}/levels`);
  return { ok: true, error: null };
}
