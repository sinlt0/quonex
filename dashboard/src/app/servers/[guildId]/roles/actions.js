'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { limitFor } from '../../../../lib/panelLimits';
import {
  notifyInteractivePublish,
  notifyInteractiveDelete,
  notifyReactionRoleAdd,
  notifyReactionRoleRemove
} from '../../../../lib/botApi';
import {
  validateInteractiveBlocks,
  sanitizeInteractiveBlocks,
  INTERACTIVE_ERROR_MESSAGES,
  MAX_NAME_LENGTH,
  getPreset
} from '../../../../lib/interactiveServer';

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

function messageFor(code) {
  return INTERACTIVE_ERROR_MESSAGES[code] || 'Something went wrong.';
}

export async function createInteractiveAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const name = formData.get('name')?.toString().trim();
  if (!name) return { ok: false, error: 'Enter a name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };

  const existing = await prisma.interactiveMessage.findMany({ where: { guildId } });
  if (existing.some(row => row.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'You already have a message with that name.' };
  }

  const limit = await limitFor(guildId, 'interactiveMessages');
  if (existing.length >= limit) return { ok: false, error: `${messageFor('limit-reached')} (${limit})` };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const preset = getPreset(formData.get('preset')?.toString());
  const row = await prisma.interactiveMessage.create({ data: { guildId, name, blocks: preset.blocks } });
  redirect(`/servers/${guildId}/roles/${row.id}`);
}

export async function saveInteractiveAction(guildId, id, payload) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return { ok: false, error: messageFor('not-found') };

  const name = String(payload?.name || '').trim();
  if (!name) return { ok: false, error: 'Enter a name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };

  const clash = await prisma.interactiveMessage.findFirst({
    where: { guildId, id: { not: id }, name: { equals: name, mode: 'insensitive' } }
  });
  if (clash) return { ok: false, error: 'You already have a message with that name.' };

  const validation = validateInteractiveBlocks(payload?.blocks);
  if (!validation.ok) return { ok: false, error: messageFor(validation.error) };

  const accentColor = String(payload?.accentColor || '').trim();
  if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) return { ok: false, error: messageFor('invalid-color') };

  const logChannelId = String(payload?.logChannelId || '').trim();
  if (logChannelId && !/^\d{15,25}$/.test(logChannelId)) return { ok: false, error: messageFor('invalid-log-channel') };

  await prisma.interactiveMessage.update({
    where: { id },
    data: {
      name,
      blocks: sanitizeInteractiveBlocks(payload.blocks),
      accentColor: accentColor || null,
      logChannelId: logChannelId || null
    }
  });
  revalidatePath(`/servers/${guildId}/roles`);

  if (!row.channelId || !row.messageId) return { ok: true, error: null, synced: false };

  const result = await notifyInteractivePublish({ guildId, id, channelId: row.channelId });
  if (!result.ok) {
    return { ok: true, error: null, synced: false, warning: messageFor(result.data?.error === 'unreachable' ? 'unreachable' : result.data?.error) };
  }
  return { ok: true, error: null, synced: true };
}

export async function publishInteractiveAction(guildId, id, channelId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };
  if (!channelId) return { ok: false, error: messageFor('channel-missing') };

  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return { ok: false, error: messageFor('not-found') };

  const result = await notifyInteractivePublish({ guildId, id, channelId });
  if (!result.ok) {
    const code = result.data?.error;
    return { ok: false, error: code === 'unreachable' ? 'Could not reach the bot.' : messageFor(code) };
  }

  revalidatePath(`/servers/${guildId}/roles`);
  return { ok: true, error: null, channelId };
}

export async function deleteInteractiveAction(guildId, id) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return;

  const result = await notifyInteractiveDelete({ guildId, id });
  if (!result.ok) await prisma.interactiveMessage.deleteMany({ where: { id, guildId } });

  revalidatePath(`/servers/${guildId}/roles`);
}

const REACTION_ERRORS = {
  'channel-missing': 'Pick a valid channel.',
  'message-missing': 'That message was not found in that channel.',
  'invalid-emoji': 'That emoji is not valid.',
  'invalid-role': 'That role cannot be assigned by the bot.',
  'limit-reached': 'Reaction role limit reached. Upgrade to premium for more.',
  duplicate: 'That emoji is already used on that message.',
  'react-failed': 'The bot could not react with that emoji. Custom emojis must come from a server the bot is in.',
  unreachable: 'Could not reach the bot.'
};

export async function addReactionRoleAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const channelId = formData.get('channelId')?.toString();
  const rawMessage = formData.get('messageId')?.toString().trim() || '';
  const emoji = formData.get('emoji')?.toString().trim();
  const roleId = formData.get('roleId')?.toString();
  const requestedMode = formData.get('mode')?.toString();
  const mode = requestedMode === 'once' || requestedMode === 'unique' ? requestedMode : 'toggle';

  const messageId = rawMessage.split('/').pop();
  if (!channelId || !/^\d{15,25}$/.test(messageId || '')) return { ok: false, error: 'Pick a channel and paste a message ID or link.' };
  if (!emoji) return { ok: false, error: 'Enter an emoji.' };
  if (!roleId) return { ok: false, error: 'Pick a role.' };

  const result = await notifyReactionRoleAdd({ guildId, channelId, messageId, emoji, roleId, mode });
  if (!result.ok) {
    const code = result.data?.error;
    const detail = result.data?.detail ? ` (${result.data.detail})` : '';
    return { ok: false, error: `${REACTION_ERRORS[code] || 'Could not add that reaction role.'}${detail}` };
  }

  revalidatePath(`/servers/${guildId}/roles/reactions`);
  return { ok: true, error: null };
}

export async function removeReactionRoleAction(guildId, id) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const result = await notifyReactionRoleRemove({ guildId, id });
  if (!result.ok) await prisma.reactionRole.deleteMany({ where: { id, guildId } });

  revalidatePath(`/servers/${guildId}/roles/reactions`);
}

export async function duplicateInteractiveAction(guildId, id) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return;

  const [existing, limit] = await Promise.all([prisma.interactiveMessage.findMany({ where: { guildId } }), limitFor(guildId, 'interactiveMessages')]);
  if (existing.length >= limit) return;

  const names = new Set(existing.map(item => item.name.toLowerCase()));
  let name = `${row.name} copy`.slice(0, MAX_NAME_LENGTH);
  for (let n = 2; names.has(name.toLowerCase()); n += 1) name = `${row.name} copy ${n}`.slice(0, MAX_NAME_LENGTH);

  const copy = await prisma.interactiveMessage.create({
    data: { guildId, name, blocks: row.blocks, accentColor: row.accentColor, logChannelId: row.logChannelId }
  });
  revalidatePath(`/servers/${guildId}/roles`);
  redirect(`/servers/${guildId}/roles/${copy.id}`);
}
