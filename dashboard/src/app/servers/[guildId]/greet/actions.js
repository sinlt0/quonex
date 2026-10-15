'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { isGuildPremium } from '../../../../lib/panelLimits';
import { validateBlocksClient } from '../../../../lib/greetBlocks';

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
  const existing = await prisma.greetSettings.findUnique({ where: { guildId } });
  if (existing) return existing;
  return prisma.greetSettings.create({ data: { guildId } });
}

const TOGGLE_FIELDS = ['joinEnabled', 'joinCardEnabled', 'joinDmEnabled', 'leaveEnabled', 'banEnabled', 'banDmEnabled'];
const CHANNEL_FIELDS = ['joinChannelId', 'leaveChannelId', 'banChannelId'];
const BLOCK_FIELDS = ['joinBlocks', 'joinDmBlocks', 'leaveBlocks', 'banBlocks', 'banDmBlocks'];

export async function updateGreetToggleAction(guildId, field, enabled) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!TOGGLE_FIELDS.includes(field)) return { ok: false, error: 'Unknown setting.' };

  await ensureSettings(guildId);
  await prisma.greetSettings.update({ where: { guildId }, data: { [field]: enabled } });
  revalidatePath(`/servers/${guildId}/greet`);
  return { ok: true, error: null };
}

export async function updateGreetChannelAction(guildId, field, channelId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!CHANNEL_FIELDS.includes(field)) return { ok: false, error: 'Unknown setting.' };

  await ensureSettings(guildId);
  await prisma.greetSettings.update({ where: { guildId }, data: { [field]: channelId || null } });
  revalidatePath(`/servers/${guildId}/greet`);
  return { ok: true, error: null };
}

export async function updateGreetBackgroundAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const premium = await isGuildPremium(guildId);
  if (!premium) return { ok: false, error: 'Welcome cards are a premium feature.' };

  const url = formData.get('url')?.toString().trim() || null;
  if (url && !/^https?:\/\//.test(url)) return { ok: false, error: 'Enter a valid image URL.' };

  await ensureSettings(guildId);
  await prisma.greetSettings.update({ where: { guildId }, data: { joinCardBackground: url } });
  revalidatePath(`/servers/${guildId}/greet`);
  return { ok: true, error: null };
}

export async function saveGreetBlocksAction(guildId, field, blocks) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!BLOCK_FIELDS.includes(field)) return { ok: false, error: 'Unknown field.' };

  const validation = validateBlocksClient(blocks);
  if (!validation.ok) return { ok: false, error: validation.message };

  await ensureSettings(guildId);
  await prisma.greetSettings.update({ where: { guildId }, data: { [field]: blocks } });
  revalidatePath(`/servers/${guildId}/greet`);
  return { ok: true, error: null };
}
