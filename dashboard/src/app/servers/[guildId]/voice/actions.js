'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { limitFor } from '../../../../lib/panelLimits';

const BOOLEAN_FIELDS = ['saveProfiles', 'autoTransfer', 'blockDuringRaid', 'allowInvites', 'panelEnabled'];
const SNOWFLAKE = /^\d{15,22}$/;

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;
  const guilds = await getMutualGuilds(session.accessToken);
  return guilds.find(item => item.id === guildId) ? session : null;
}

async function ensureSettings(guildId) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.tempVoiceSettings.upsert({ where: { guildId }, update: {}, create: { guildId } });
}

export async function updateVoiceToggleAction(guildId, field, value) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  if (!BOOLEAN_FIELDS.includes(field)) return { ok: false, error: 'Unknown setting.' };
  await ensureSettings(guildId);
  await prisma.tempVoiceSettings.update({ where: { guildId }, data: { [field]: Boolean(value) } });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}

export async function updateVoiceLogChannelAction(guildId, channelId) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  if (channelId && !SNOWFLAKE.test(channelId)) return { ok: false, error: 'Invalid channel.' };
  await ensureSettings(guildId);
  await prisma.tempVoiceSettings.update({ where: { guildId }, data: { logChannelId: channelId || null } });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}

export async function updateVoiceNumbersAction(guildId, prevState, formData) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  const graceSeconds = Number.parseInt(formData.get('graceSeconds'), 10);
  const maxChannels = Number.parseInt(formData.get('maxChannels'), 10);
  if (!Number.isInteger(graceSeconds) || graceSeconds < 0 || graceSeconds > 600) return { ok: false, error: 'Hand-over delay must be 0 to 600 seconds.' };
  if (!Number.isInteger(maxChannels) || maxChannels < 1 || maxChannels > 200) return { ok: false, error: 'Max rooms must be 1 to 200.' };
  await ensureSettings(guildId);
  await prisma.tempVoiceSettings.update({ where: { guildId }, data: { graceSeconds, maxChannels } });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}

export async function addLobbyAction(guildId, prevState, formData) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  const channelId = String(formData.get('channelId') || '');
  const categoryId = String(formData.get('categoryId') || '');
  if (!SNOWFLAKE.test(channelId)) return { ok: false, error: 'Pick a voice channel.' };
  if (categoryId && !SNOWFLAKE.test(categoryId)) return { ok: false, error: 'Invalid category.' };

  const [count, existing, isRoom] = await Promise.all([
    prisma.tempVoiceLobby.count({ where: { guildId } }),
    prisma.tempVoiceLobby.findUnique({ where: { channelId } }),
    prisma.tempVoiceChannel.findUnique({ where: { channelId } })
  ]);
  const limit = await limitFor(guildId, 'voiceLobbies');
  if (count >= limit) return { ok: false, error: `You reached the limit of ${limit} lobbies.` };
  if (existing) return { ok: false, error: 'That channel is already a lobby.' };
  if (isRoom) return { ok: false, error: 'That channel is a temporary room.' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await prisma.tempVoiceLobby.create({ data: { guildId, channelId, categoryId: categoryId || null } });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}

export async function updateLobbyAction(guildId, lobbyId, prevState, formData) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  const lobby = await prisma.tempVoiceLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby || lobby.guildId !== guildId) return { ok: false, error: 'Lobby not found.' };

  const nameTemplate = String(formData.get('nameTemplate') || '').trim();
  const userLimit = Number.parseInt(formData.get('userLimit'), 10);
  const bitrateKbps = Number.parseInt(formData.get('bitrate'), 10);
  const cooldownSeconds = Number.parseInt(formData.get('cooldownSeconds'), 10);
  const categoryId = String(formData.get('categoryId') || '');
  const ownerManaged = formData.get('ownerManaged') === 'on';
  const allowedRoleIds = formData.getAll('allowedRoleIds').map(String).filter(id => SNOWFLAKE.test(id)).slice(0, 10);
  const blockedRoleIds = formData.getAll('blockedRoleIds').map(String).filter(id => SNOWFLAKE.test(id)).slice(0, 10);

  if (!nameTemplate || nameTemplate.length > 100) return { ok: false, error: 'Name template must be 1 to 100 characters.' };
  if (!Number.isInteger(userLimit) || userLimit < 0 || userLimit > 99) return { ok: false, error: 'User limit must be 0 to 99.' };
  if (!Number.isInteger(bitrateKbps) || bitrateKbps < 0 || bitrateKbps > 384) return { ok: false, error: 'Bitrate must be 0 to 384 kbps.' };
  if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 3600) return { ok: false, error: 'Cooldown must be 0 to 3600 seconds.' };
  if (categoryId && !SNOWFLAKE.test(categoryId)) return { ok: false, error: 'Invalid category.' };

  await prisma.tempVoiceLobby.update({
    where: { id: lobbyId },
    data: { nameTemplate, userLimit, bitrate: bitrateKbps ? bitrateKbps * 1000 : null, cooldownSeconds, categoryId: categoryId || null, ownerManaged, allowedRoleIds, blockedRoleIds }
  });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}

export async function removeLobbyAction(guildId, lobbyId) {
  if (!(await requireGuildAccess(guildId))) return { ok: false, error: 'Not authorized.' };
  const lobby = await prisma.tempVoiceLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby || lobby.guildId !== guildId) return { ok: false, error: 'Lobby not found.' };
  await prisma.tempVoiceLobby.delete({ where: { id: lobbyId } });
  revalidatePath(`/servers/${guildId}/voice`);
  return { ok: true, error: null };
}
