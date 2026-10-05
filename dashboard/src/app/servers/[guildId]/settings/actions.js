'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { setPrefix, resetPrefix } from '../../../../lib/guildPrefix';
import { isGuildPremium } from '../../../../lib/panelLimits';
import { PREMIUM_DURATIONS } from '../../../../lib/premiumDurations';

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

export async function updatePrefixAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const prefix = formData.get('prefix')?.toString().trim();
  if (!prefix) return { ok: false, error: 'Enter a prefix.' };
  if (prefix.length > 5) return { ok: false, error: 'Prefix must be 5 characters or fewer.' };

  await setPrefix(guildId, prefix);
  revalidatePath(`/servers/${guildId}/settings`);
  return { ok: true, error: null };
}

export async function resetPrefixAction(guildId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  await resetPrefix(guildId);
  revalidatePath(`/servers/${guildId}/settings`);
}

export async function setNoPrefixModeAction(guildId, mode) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const premium = await isGuildPremium(guildId);
  if (!premium) return;

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.guildNoPrefix.upsert({
    where: { guildId },
    update: { mode, updatedBy: session.user.id },
    create: { guildId, mode, updatedBy: session.user.id }
  });

  revalidatePath(`/servers/${guildId}/settings`);
}

export async function addNoPrefixUserAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const premium = await isGuildPremium(guildId);
  if (!premium) return { ok: false, error: 'This server does not have premium.' };

  const userId = formData.get('userId')?.toString().trim();
  if (!userId || !/^\d{15,20}$/.test(userId)) {
    return { ok: false, error: 'Enter a valid Discord user ID.' };
  }

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const guildNp = await prisma.guildNoPrefix.upsert({
    where: { guildId },
    update: {},
    create: { guildId, mode: 'specific', updatedBy: session.user.id }
  });

  await prisma.guildNoPrefixUser.upsert({
    where: { guildNoPrefixId_userId: { guildNoPrefixId: guildNp.id, userId } },
    update: {},
    create: { guildNoPrefixId: guildNp.id, userId }
  });

  revalidatePath(`/servers/${guildId}/settings`);
  return { ok: true, error: null };
}

export async function removeNoPrefixUserAction(guildId, userId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const guildNp = await prisma.guildNoPrefix.findUnique({ where: { guildId } });
  if (guildNp) {
    await prisma.guildNoPrefixUser.deleteMany({ where: { guildNoPrefixId: guildNp.id, userId } });
  }

  revalidatePath(`/servers/${guildId}/settings`);
}

export async function claimPremiumAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const keyValue = (formData.get('key')?.toString() || '').trim().toUpperCase();
  if (!keyValue) return { ok: false, error: 'Enter a key.' };

  const key = await prisma.premiumKey.findUnique({ where: { key: keyValue } });
  if (!key || key.claimedAt) {
    return { ok: false, error: 'Invalid or already used key.' };
  }

  const duration = PREMIUM_DURATIONS.find(item => item.id === key.duration);

  const existing = await prisma.premium.findUnique({ where: { guildId } });
  const base = existing && existing.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt.getTime() : Date.now();
  const expiresAt = duration.ms === null ? null : new Date(base + duration.ms);

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.premium.upsert({
    where: { guildId },
    update: { expiresAt, lifetime: duration.ms === null, addedBy: session.user.id },
    create: { guildId, expiresAt, lifetime: duration.ms === null, addedBy: session.user.id }
  });
  await prisma.premiumKey.update({
    where: { key: keyValue },
    data: { claimedBy: session.user.id, claimedAt: new Date(), usedGuildId: guildId }
  });

  revalidatePath(`/servers/${guildId}/settings`);
  return { ok: true, error: null, label: duration.label };
}
