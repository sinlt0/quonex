'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../../../../auth';
import { getMutualGuilds } from '../../../../lib/discord';
import { prisma } from '../../../../lib/db';
import { limitFor } from '../../../../lib/panelLimits';
import {
  notifyApplicationPanelCreated,
  notifyApplicationPanelDeleted,
  notifyApplicationDecision
} from '../../../../lib/botApi';

async function requireGuildAccess(guildId) {
  const session = await auth();
  if (!session?.accessToken) return null;

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return null;

  return session;
}

export async function createApplicationPanelAction(guildId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const name = formData.get('name')?.toString().trim();
  const reviewChannelId = formData.get('reviewChannelId')?.toString();
  const channelId = formData.get('channelId')?.toString();
  const acceptRoleId = formData.get('acceptRoleId')?.toString() || null;

  if (!name || !reviewChannelId || !channelId) {
    return { ok: false, error: 'Fill in every required field.' };
  }

  const limit = await limitFor(guildId, 'applicationPanels');
  const current = await prisma.applicationPanel.count({ where: { guildId } });
  if (current >= limit) {
    return { ok: false, error: `This server is at its application panel limit (${limit}).` };
  }

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

  const panel = await prisma.applicationPanel.create({
    data: {
      guildId,
      name,
      channelId,
      reviewChannelId,
      acceptRoleId,
      reviewerRoleIds: [],
      questions: [],
      createdBy: session.user.id
    }
  });

  const result = await notifyApplicationPanelCreated({ guildId, channelId, panelId: panel.id });
  if (!result.ok) {
    return {
      ok: false,
      error: 'Panel saved, but the bot could not post the message. Check the bot is online and has access to that channel.'
    };
  }

  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function deleteApplicationPanelAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const result = await notifyApplicationPanelDeleted({ guildId, panelId });
  if (!result.ok) {
    return { ok: false, error: result.data?.error || 'Could not delete that panel. Check the bot is online.' };
  }

  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function setReviewChannelAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const channelId = formData.get('channelId')?.toString();
  if (!channelId) return { ok: false, error: 'Pick a channel.' };

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };

  await prisma.applicationPanel.update({ where: { id: panelId }, data: { reviewChannelId: channelId } });
  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function setAcceptRoleAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const roleId = formData.get('roleId')?.toString() || null;

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };

  await prisma.applicationPanel.update({ where: { id: panelId }, data: { acceptRoleId: roleId } });
  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function addReviewerRoleAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const roleId = formData.get('roleId')?.toString();
  if (!roleId) return { ok: false, error: 'Pick a role.' };

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };
  if (panel.reviewerRoleIds.includes(roleId)) return { ok: false, error: 'That role already reviews this panel.' };

  const limit = await limitFor(guildId, 'reviewerRoles');
  if (panel.reviewerRoleIds.length >= limit) return { ok: false, error: `This panel is at its reviewer role limit (${limit}).` };

  await prisma.applicationPanel.update({
    where: { id: panelId },
    data: { reviewerRoleIds: [...panel.reviewerRoleIds, roleId] }
  });
  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function removeReviewerRoleAction(guildId, panelId, roleId) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return;

  await prisma.applicationPanel.update({
    where: { id: panelId },
    data: { reviewerRoleIds: panel.reviewerRoleIds.filter(id => id !== roleId) }
  });
  revalidatePath(`/servers/${guildId}/applications`);
}

export async function addQuestionAction(guildId, panelId, prevState, formData) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const question = formData.get('question')?.toString().trim();
  if (!question) return { ok: false, error: 'Enter a question.' };

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'Panel not found.' };

  const limit = await limitFor(guildId, 'applicationQuestions');
  if (panel.questions.length >= limit) return { ok: false, error: `This panel is at its question limit (${limit}).` };

  await prisma.applicationPanel.update({ where: { id: panelId }, data: { questions: [...panel.questions, question] } });
  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}

export async function removeQuestionAction(guildId, panelId, index) {
  const session = await requireGuildAccess(guildId);
  if (!session) return;

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return;

  const questions = [...panel.questions];
  questions.splice(index, 1);

  await prisma.applicationPanel.update({ where: { id: panelId }, data: { questions } });
  revalidatePath(`/servers/${guildId}/applications`);
}

export async function decideApplicationAction(guildId, applicationId, accept) {
  const session = await requireGuildAccess(guildId);
  if (!session) return { ok: false, error: 'Not authorized.' };

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.guildId !== guildId) return { ok: false, error: 'Application not found.' };
  if (application.status !== 'pending') return { ok: false, error: 'This application has already been reviewed.' };

  const result = await notifyApplicationDecision({ guildId, applicationId, reviewerId: session.user.id, accept });
  if (!result.ok) {
    return { ok: false, error: result.data?.error || 'Could not reach the bot. Check it is online.' };
  }

  revalidatePath(`/servers/${guildId}/applications`);
  return { ok: true, error: null };
}
