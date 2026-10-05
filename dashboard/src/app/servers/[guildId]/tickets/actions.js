'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { notifyTicketClose } from '../../../../lib/botApi';

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

export async function claimTicketAction(guildId, ticketId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.guildId !== guildId) return { ok: false, error: 'Ticket not found.' };
  if (ticket.status === 'closed') return { ok: false, error: 'This ticket is already closed.' };
  if (ticket.claimedBy) return { ok: false, error: 'This ticket is already claimed.' };

  await prisma.ticket.update({ where: { id: ticketId }, data: { claimedBy: session.user.id } });
  revalidatePath(`/servers/${guildId}/tickets`);
  return { ok: true, error: null };
}

export async function releaseTicketAction(guildId, ticketId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.guildId !== guildId) return { ok: false, error: 'Ticket not found.' };
  if (!ticket.claimedBy) return { ok: false, error: 'This ticket is not currently claimed.' };

  await prisma.ticket.update({ where: { id: ticketId }, data: { claimedBy: null } });
  revalidatePath(`/servers/${guildId}/tickets`);
  return { ok: true, error: null };
}

export async function closeTicketAction(guildId, ticketId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.guildId !== guildId) return { ok: false, error: 'Ticket not found.' };
  if (ticket.status === 'closed') return { ok: false, error: 'This ticket is already closed.' };

  const result = await notifyTicketClose({ guildId, channelId: ticket.channelId, closerId: session.user.id });
  if (!result.ok) {
    return { ok: false, error: result.data?.error || 'Could not close that ticket. Check the bot is online.' };
  }

  revalidatePath(`/servers/${guildId}/tickets`);
  return { ok: true, error: null };
}
