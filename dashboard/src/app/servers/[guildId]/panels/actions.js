'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { limitFor } from '../../../../lib/panelLimits';
import {
  notifyPanelCreated,
  notifyPanelDeleted,
  notifyStaffRoleAdd,
  notifyStaffRoleRemove
} from '../../../../lib/botApi';

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

export async function createPanelAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const name = formData.get('name')?.toString().trim();
  const categoryId = formData.get('categoryId')?.toString();
  const staffRoleId = formData.get('staffRoleId')?.toString();
  const channelId = formData.get('channelId')?.toString();
  const transcriptChannelId = formData.get('transcriptChannelId')?.toString() || null;

  if (!name || !categoryId || !staffRoleId || !channelId) {
    return { ok: false, error: 'Fill in every required field.' };
  }

  const limit = await limitFor(guildId, 'panels');
  const current = await prisma.panel.count({ where: { guildId } });
  if (current >= limit) {
    return { ok: false, error: `This server is at its panel limit (${limit}).` };
  }

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

  const panel = await prisma.panel.create({
    data: {
      guildId,
      name,
      categoryIds: [categoryId],
      channelId,
      createdBy: session.user.id,
      staffRoleIds: [staffRoleId],
      questions: [],
      transcriptChannelId
    }
  });

  const result = await notifyPanelCreated({ guildId, channelId, panelId: panel.id });
  if (!result.ok) {
    return {
      ok: false,
      error: 'Panel saved, but the bot could not post the message. Check the bot is online and has access to that channel.'
    };
  }

  revalidatePath(`/servers/${guildId}/panels`);
  return { ok: true, error: null };
}

export async function deletePanelAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const result = await notifyPanelDeleted({ guildId, panelId });
  if (!result.ok) {
    return { ok: false, error: result.data?.error || 'Could not delete that panel. Check the bot is online.' };
  }

  revalidatePath(`/servers/${guildId}/panels`);
  return { ok: true, error: null };
}

export async function addStaffRoleAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const roleId = formData.get('roleId')?.toString();
  if (!roleId) return { ok: false, error: 'Pick a role.' };

  const result = await notifyStaffRoleAdd({ guildId, panelId, roleId });
  if (!result.ok) return { ok: false, error: result.data?.error || 'Could not add that role.' };

  revalidatePath(`/servers/${guildId}/panels`);
  return { ok: true, error: null };
}

export async function removeStaffRoleAction(guildId, panelId, roleId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  await notifyStaffRoleRemove({ guildId, panelId, roleId });
  revalidatePath(`/servers/${guildId}/panels`);
}

export async function addCategoryAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const categoryId = formData.get('categoryId')?.toString();
  if (!categoryId) return { ok: false, error: 'Pick a category.' };

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };
  if (panel.categoryIds.includes(categoryId)) return { ok: false, error: 'That category is already on this panel.' };

  const limit = await limitFor(guildId, 'panelCategories');
  if (panel.categoryIds.length >= limit) return { ok: false, error: `This panel is at its category limit (${limit}).` };

  await prisma.panel.update({ where: { id: panelId }, data: { categoryIds: [...panel.categoryIds, categoryId] } });
  revalidatePath(`/servers/${guildId}/panels`);
  return { ok: true, error: null };
}

export async function removeCategoryAction(guildId, panelId, categoryId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return;
  if (panel.categoryIds.length <= 1) return;

  await prisma.panel.update({
    where: { id: panelId },
    data: { categoryIds: panel.categoryIds.filter(id => id !== categoryId) }
  });
  revalidatePath(`/servers/${guildId}/panels`);
}

export async function addQuestionAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const question = formData.get('question')?.toString().trim();
  if (!question) return { ok: false, error: 'Enter a question.' };

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };

  const limit = await limitFor(guildId, 'formQuestions');
  if (panel.questions.length >= limit) return { ok: false, error: `This panel is at its question limit (${limit}).` };

  await prisma.panel.update({ where: { id: panelId }, data: { questions: [...panel.questions, question] } });
  revalidatePath(`/servers/${guildId}/panels`);
  return { ok: true, error: null };
}

export async function removeQuestionAction(guildId, panelId, index) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return;

  const questions = [...panel.questions];
  questions.splice(index, 1);

  await prisma.panel.update({ where: { id: panelId }, data: { questions } });
  revalidatePath(`/servers/${guildId}/panels`);
}
