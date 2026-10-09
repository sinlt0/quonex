const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const prisma = require('./db');
const { v2Message, SEPARATOR } = require('./components');
const { em } = require('./emojis');
const { isDev, isGuildPremium } = require('./permissions');
const { LIMITS } = require('../config/limits');
const { APPLICATION_MODAL_PAGE_SIZE, APPLICATION_ERROR_MESSAGES } = require('../config/applications');
const { startSession, recordAnswers, getAnswers, clearSession } = require('./applicationFormSessions');

async function limitFor(guildId, key) {
  const premium = await isGuildPremium(guildId);
  return premium ? LIMITS.premium[key] : LIMITS.free[key];
}

async function countApplicationPanels(guildId) {
  return prisma.applicationPanel.count({ where: { guildId } });
}

async function listApplicationPanels(guildId) {
  return prisma.applicationPanel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

function isReviewer(member, panel) {
  if (isDev(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return panel.reviewerRoleIds.some(roleId => member.roles.cache.has(roleId));
}

function buildPanelMessage(panel) {
  const apply = new ButtonBuilder()
    .setCustomId(`application_open_${panel.id}`)
    .setLabel('Apply')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝');

  const row = new ActionRowBuilder().addComponents(apply);

  return v2Message([`## ${panel.name}`, SEPARATOR, 'Click the button below to submit an application.'], { extraComponents: [row] });
}

function buildReviewRow(application) {
  const accept = new ButtonBuilder()
    .setCustomId(`application_accept_${application.id}`)
    .setLabel('Accept')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const deny = new ButtonBuilder()
    .setCustomId(`application_deny_${application.id}`)
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  return new ActionRowBuilder().addComponents(accept, deny);
}

function buildReviewMessage(panel, application, applicant, { decided } = {}) {
  const lines = [
    `## Application — ${panel.name}`,
    SEPARATOR,
    `Applicant: ${applicant ? `${applicant} (${applicant.tag || applicant.id})` : `<@${application.applicantId}>`}`,
    `Submitted: <t:${Math.floor(new Date(application.createdAt).getTime() / 1000)}:R>`
  ];

  const answers = Array.isArray(application.answers) ? application.answers : [];
  if (answers.length) {
    lines.push(SEPARATOR);
    for (const entry of answers) {
      lines.push(`**${entry.question}**`, entry.answer || '*No answer provided.*');
    }
  }

  const options = { allowedMentions: { users: [] } };
  if (decided) {
    lines.push(SEPARATOR);
    lines.push(decided);
  } else {
    options.extraComponents = [buildReviewRow(application)];
  }

  return v2Message(lines, options);
}

function buildApplicationModal(panel, page) {
  const totalPages = Math.ceil(panel.questions.length / APPLICATION_MODAL_PAGE_SIZE);
  const pageQuestions = panel.questions.slice(page * APPLICATION_MODAL_PAGE_SIZE, page * APPLICATION_MODAL_PAGE_SIZE + APPLICATION_MODAL_PAGE_SIZE);

  const title = totalPages > 1 ? `${panel.name} (${page + 1}/${totalPages})` : panel.name;

  const modal = new ModalBuilder().setCustomId(`application_modal_${panel.id}_${page}`).setTitle(title.slice(0, 45) || 'Apply');

  const rows = pageQuestions.map((question, offset) => {
    const globalIndex = page * APPLICATION_MODAL_PAGE_SIZE + offset;
    const input = new TextInputBuilder()
      .setCustomId(`question_${globalIndex}`)
      .setLabel(question.slice(0, 45))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);
    return new ActionRowBuilder().addComponents(input);
  });

  modal.addComponents(...rows);
  return modal;
}

function buildModalContinueRow(panel, nextPage) {
  const button = new ButtonBuilder()
    .setCustomId(`application_modal_continue_${panel.id}_${nextPage}`)
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(em.arrow.component());

  return new ActionRowBuilder().addComponents(button);
}

async function postPanelMessage(panel, targetChannel) {
  const message = await targetChannel.send(buildPanelMessage(panel));
  return prisma.applicationPanel.update({ where: { id: panel.id }, data: { messageId: message.id } });
}

async function createApplicationPanel({ guildId, name, channelId, reviewChannelId, acceptRoleId, createdBy, targetChannel }) {
  const limit = await limitFor(guildId, 'applicationPanels');
  const current = await countApplicationPanels(guildId);
  if (current >= limit) return { ok: false, error: 'limit' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

  const panel = await prisma.applicationPanel.create({
    data: {
      guildId,
      name,
      channelId,
      reviewChannelId,
      acceptRoleId: acceptRoleId || null,
      reviewerRoleIds: [],
      questions: [],
      createdBy
    }
  });

  const updated = await postPanelMessage(panel, targetChannel);
  return { ok: true, panel: updated };
}

async function deleteApplicationPanel(guildId, panelId, client) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  if (client && panel.messageId) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild ? guild.channels.cache.get(panel.channelId) : null;
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) await message.delete().catch(() => {});
    }
  }

  await prisma.application.deleteMany({ where: { panelId } });
  await prisma.applicationPanel.delete({ where: { id: panelId } });

  return { ok: true, panel };
}

async function setReviewChannel(guildId, panelId, channelId) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  const updated = await prisma.applicationPanel.update({ where: { id: panelId }, data: { reviewChannelId: channelId } });
  return { ok: true, panel: updated };
}

async function setAcceptRole(guildId, panelId, roleId) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  const updated = await prisma.applicationPanel.update({ where: { id: panelId }, data: { acceptRoleId: roleId || null } });
  return { ok: true, panel: updated };
}

async function addReviewerRole(guildId, panelId, roleId) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };
  if (panel.reviewerRoleIds.includes(roleId)) return { ok: false, error: 'role-already-added' };

  const limit = await limitFor(guildId, 'reviewerRoles');
  if (panel.reviewerRoleIds.length >= limit) return { ok: false, error: 'limit' };

  const updated = await prisma.applicationPanel.update({
    where: { id: panelId },
    data: { reviewerRoleIds: [...panel.reviewerRoleIds, roleId] }
  });
  return { ok: true, panel: updated };
}

async function removeReviewerRole(guildId, panelId, roleId) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };
  if (!panel.reviewerRoleIds.includes(roleId)) return { ok: false, error: 'role-not-found' };

  const updated = await prisma.applicationPanel.update({
    where: { id: panelId },
    data: { reviewerRoleIds: panel.reviewerRoleIds.filter(id => id !== roleId) }
  });
  return { ok: true, panel: updated };
}

async function addQuestion(guildId, panelId, question) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  const limit = await limitFor(guildId, 'applicationQuestions');
  if (panel.questions.length >= limit) return { ok: false, error: 'limit' };

  const updated = await prisma.applicationPanel.update({
    where: { id: panelId },
    data: { questions: [...panel.questions, question] }
  });
  return { ok: true, panel: updated };
}

async function removeQuestion(guildId, panelId, index) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };
  if (index < 0 || index >= panel.questions.length) return { ok: false, error: 'question-missing' };

  const questions = [...panel.questions];
  questions.splice(index, 1);

  const updated = await prisma.applicationPanel.update({ where: { id: panelId }, data: { questions } });
  return { ok: true, panel: updated };
}

async function submitApplication({ guild, member, panelId, answers }) {
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel) return { ok: false, error: 'panel-missing' };

  const existing = await prisma.application.findFirst({
    where: { panelId, applicantId: member.id, status: 'pending' }
  });
  if (existing) return { ok: false, error: 'already-pending' };

  const application = await prisma.application.create({
    data: {
      guildId: guild.id,
      panelId,
      applicantId: member.id,
      answers: answers || [],
      status: 'pending'
    }
  });

  const reviewChannel = guild.channels.cache.get(panel.reviewChannelId) || (await guild.channels.fetch(panel.reviewChannelId).catch(() => null));

  if (reviewChannel) {
    const message = await reviewChannel.send(buildReviewMessage(panel, application, member.user)).catch(() => null);
    if (message) {
      await prisma.application.update({ where: { id: application.id }, data: { reviewMessageId: message.id } });
    }
  }

  await member.send(v2Message([`${em.success} Your application for **${panel.name}** in **${guild.name}** has been submitted.`])).catch(() => {});

  return { ok: true, application };
}

async function decideApplication({ application, panel, guild, reviewerId, accept }) {
  if (application.status !== 'pending') return { ok: false, error: 'already-reviewed' };

  const status = accept ? 'accepted' : 'denied';
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: { status, reviewedBy: reviewerId, reviewedAt: new Date() }
  });

  if (accept && panel.acceptRoleId) {
    const member = await guild.members.fetch(application.applicantId).catch(() => null);
    if (member) await member.roles.add(panel.acceptRoleId).catch(() => {});
  }

  const applicant = await guild.client.users.fetch(application.applicantId).catch(() => null);
  if (applicant) {
    const verb = accept ? 'accepted' : 'denied';
    await applicant.send(v2Message([`${em[accept ? 'success' : 'error']} Your application for **${panel.name}** in **${guild.name}** was ${verb}.`])).catch(() => {});
  }

  return { ok: true, application: updated };
}

async function handleOpenButton(interaction) {
  const panelId = interaction.customId.slice('application_open_'.length);
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });

  if (!panel) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  const existing = await prisma.application.findFirst({
    where: { panelId, applicantId: interaction.user.id, status: 'pending' }
  });
  if (existing) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['already-pending']}`], { ephemeral: true }));
    return;
  }

  if (panel.questions.length) {
    startSession(interaction.user.id, panelId);
    await interaction.showModal(buildApplicationModal(panel, 0));
    return;
  }

  const result = await submitApplication({ guild: interaction.guild, member: interaction.member, panelId });
  if (!result.ok) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.reply(v2Message([`${em.success} Application submitted.`], { ephemeral: true }));
}

async function handleApplicationModalSubmit(interaction) {
  const match = interaction.customId.match(/^application_modal_(.+)_(\d+)$/);
  if (!match) return;

  const [, panelId, pageRaw] = match;
  const page = Number(pageRaw);
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });

  if (!panel) {
    clearSession(interaction.user.id, panelId);
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  const pageQuestions = panel.questions.slice(page * APPLICATION_MODAL_PAGE_SIZE, page * APPLICATION_MODAL_PAGE_SIZE + APPLICATION_MODAL_PAGE_SIZE);
  const entries = pageQuestions.map((question, offset) => {
    const globalIndex = page * APPLICATION_MODAL_PAGE_SIZE + offset;
    return { index: globalIndex, question, answer: interaction.fields.getTextInputValue(`question_${globalIndex}`) };
  });
  recordAnswers(interaction.user.id, panelId, entries);

  const totalPages = Math.ceil(panel.questions.length / APPLICATION_MODAL_PAGE_SIZE);
  const nextPage = page + 1;

  if (nextPage < totalPages) {
    const answeredSoFar = page * APPLICATION_MODAL_PAGE_SIZE + pageQuestions.length;
    await interaction.reply(
      v2Message(
        [`${em.success} Saved questions ${answeredSoFar - pageQuestions.length + 1}-${answeredSoFar} of ${panel.questions.length}.`, 'Click continue for the next set of questions.'],
        { ephemeral: true, extraComponents: [buildModalContinueRow(panel, nextPage)] }
      )
    );
    return;
  }

  const answers = getAnswers(interaction.user.id, panelId);
  clearSession(interaction.user.id, panelId);

  const result = await submitApplication({ guild: interaction.guild, member: interaction.member, panelId, answers });

  if (!result.ok) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.reply(v2Message([`${em.success} Application submitted.`], { ephemeral: true }));
}

async function handleModalContinueButton(interaction) {
  const match = interaction.customId.match(/^application_modal_continue_(.+)_(\d+)$/);
  if (!match) return;

  const [, panelId, pageRaw] = match;
  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });

  if (!panel) {
    clearSession(interaction.user.id, panelId);
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  await interaction.showModal(buildApplicationModal(panel, Number(pageRaw)));
}

async function handleAcceptButton(interaction) {
  await handleDecisionButton(interaction, 'application_accept_', true);
}

async function handleDenyButton(interaction) {
  await handleDecisionButton(interaction, 'application_deny_', false);
}

async function handleDecisionButton(interaction, prefix, accept) {
  const applicationId = interaction.customId.slice(prefix.length);
  const application = await prisma.application.findUnique({ where: { id: applicationId } });

  if (!application) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['application-missing']}`], { ephemeral: true }));
    return;
  }

  const panel = await prisma.applicationPanel.findUnique({ where: { id: application.panelId } });
  if (!panel) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  if (!isReviewer(interaction.member, panel)) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['not-reviewer']}`], { ephemeral: true }));
    return;
  }

  const result = await decideApplication({ application, panel, guild: interaction.guild, reviewerId: interaction.user.id, accept });
  if (!result.ok) {
    await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  const applicant = await interaction.client.users.fetch(application.applicantId).catch(() => null);
  const decided = `${accept ? em.success : em.error} ${accept ? 'Accepted' : 'Denied'} by <@${interaction.user.id}>.`;

  await interaction.update(buildReviewMessage(panel, result.application, applicant, { decided }));
}

module.exports = {
  limitFor,
  countApplicationPanels,
  listApplicationPanels,
  isReviewer,
  buildPanelMessage,
  createApplicationPanel,
  postPanelMessage,
  deleteApplicationPanel,
  setReviewChannel,
  setAcceptRole,
  addReviewerRole,
  removeReviewerRole,
  addQuestion,
  removeQuestion,
  submitApplication,
  decideApplication,
  handleOpenButton,
  handleApplicationModalSubmit,
  handleModalContinueButton,
  handleAcceptButton,
  handleDenyButton
};
