const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const prisma = require('./db');
const { v2Message, SEPARATOR } = require('./components');
const { em } = require('./emojis');
const { isDev, isGuildPremium } = require('./permissions');
const { LIMITS } = require('../config/limits');
const { TICKET_CHANNEL_PREFIX, MODAL_PAGE_SIZE, TRANSCRIPT_FETCH_BATCHES, ERROR_MESSAGES } = require('../config/tickets');
const { startSession, recordAnswers, getAnswers, clearSession } = require('./ticketFormSessions');

async function limitFor(guildId, key) {
  const premium = await isGuildPremium(guildId);
  return premium ? LIMITS.premium[key] : LIMITS.free[key];
}

async function countPanels(guildId) {
  return prisma.panel.count({ where: { guildId } });
}

async function countActiveTickets(guildId) {
  return prisma.ticket.count({ where: { guildId, status: 'open' } });
}

async function listPanels(guildId) {
  return prisma.panel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

async function getTicketContext(channelId) {
  const ticket = await prisma.ticket.findUnique({ where: { channelId } });
  if (!ticket) return null;
  const panel = await prisma.panel.findUnique({ where: { id: ticket.panelId } });
  return { ticket, panel };
}

function isStaffMember(member, panel) {
  if (isDev(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return panel.staffRoleIds.some(roleId => member.roles.cache.has(roleId));
}

function buildTicketControlRow(ticket) {
  const claim = new ButtonBuilder()
    .setCustomId(`ticket_claim_${ticket.id}`)
    .setLabel('Claim')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(em.claim.component());

  const close = new ButtonBuilder()
    .setCustomId(`ticket_close_${ticket.id}`)
    .setLabel('Close')
    .setStyle(ButtonStyle.Danger)
    .setEmoji(em.lock.component());

  return new ActionRowBuilder().addComponents(claim, close);
}

function buildPanelMessage(panel) {
  const open = new ButtonBuilder()
    .setCustomId(`ticket_open_${panel.id}`)
    .setLabel('Open Ticket')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(em.ticket.component());

  const row = new ActionRowBuilder().addComponents(open);

  return v2Message([`## ${panel.name}`, SEPARATOR, 'Click the button below to open a ticket.'], { extraComponents: [row] });
}

function buildTicketWelcomeMessage(ticket, panel, opener, answers = []) {
  const lines = [
    `## Ticket #${String(ticket.number).padStart(4, '0')}`,
    SEPARATOR,
    `Welcome ${opener}, support will be with you shortly.`,
    `Panel: ${panel.name}`
  ];

  if (answers.length) {
    lines.push(SEPARATOR);
    for (const entry of answers) {
      lines.push(`**${entry.question}**`, entry.answer || '*No answer provided.*');
    }
  }

  return v2Message(lines, { extraComponents: [buildTicketControlRow(ticket)], allowedMentions: { users: [opener.id] } });
}

function buildTicketModal(panel, page) {
  const totalPages = Math.ceil(panel.questions.length / MODAL_PAGE_SIZE);
  const pageQuestions = panel.questions.slice(page * MODAL_PAGE_SIZE, page * MODAL_PAGE_SIZE + MODAL_PAGE_SIZE);

  const title = totalPages > 1 ? `${panel.name} (${page + 1}/${totalPages})` : panel.name;

  const modal = new ModalBuilder().setCustomId(`ticket_modal_${panel.id}_${page}`).setTitle(title.slice(0, 45) || 'Open Ticket');

  const rows = pageQuestions.map((question, offset) => {
    const globalIndex = page * MODAL_PAGE_SIZE + offset;
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
    .setCustomId(`ticket_modal_continue_${panel.id}_${nextPage}`)
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(em.arrow.component());

  return new ActionRowBuilder().addComponents(button);
}

async function postPanelMessage(panel, targetChannel) {
  const message = await targetChannel.send(buildPanelMessage(panel));
  return prisma.panel.update({ where: { id: panel.id }, data: { messageId: message.id } });
}

async function createPanel({ guildId, name, categoryId, channelId, staffRoleId, createdBy, targetChannel, transcriptChannelId }) {
  const limit = await limitFor(guildId, 'panels');
  const current = await countPanels(guildId);
  if (current >= limit) return { ok: false, error: 'limit' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

  const panel = await prisma.panel.create({
    data: {
      guildId,
      name,
      categoryIds: [categoryId],
      channelId,
      createdBy,
      staffRoleIds: [staffRoleId],
      questions: [],
      transcriptChannelId: transcriptChannelId || null
    }
  });

  const updated = await postPanelMessage(panel, targetChannel);

  return { ok: true, panel: updated };
}

async function deletePanel(guildId, panelId, client) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  if (client && panel.messageId) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild ? guild.channels.cache.get(panel.channelId) : null;
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) await message.delete().catch(() => {});
    }
  }

  await prisma.ticket.deleteMany({ where: { panelId } });
  await prisma.panel.delete({ where: { id: panelId } });

  return { ok: true, panel };
}

async function setTranscriptChannel(guildId, panelId, channelId) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  await prisma.panel.update({ where: { id: panelId }, data: { transcriptChannelId: channelId } });
  return { ok: true };
}

async function syncAddedStaffRole(guild, panel, roleId) {
  const tickets = await prisma.ticket.findMany({ where: { panelId: panel.id, status: 'open' } });
  for (const ticket of tickets) {
    const channel = guild.channels.cache.get(ticket.channelId) || (await guild.channels.fetch(ticket.channelId).catch(() => null));
    if (!channel) continue;
    await channel.permissionOverwrites
      .edit(roleId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      })
      .catch(() => {});
  }
}

async function syncRemovedStaffRole(guild, panel, roleId) {
  const tickets = await prisma.ticket.findMany({ where: { panelId: panel.id, status: 'open' } });
  for (const ticket of tickets) {
    const channel = guild.channels.cache.get(ticket.channelId) || (await guild.channels.fetch(ticket.channelId).catch(() => null));
    if (!channel) continue;
    await channel.permissionOverwrites.delete(roleId).catch(() => {});
  }
}

async function addStaffRole({ guild, panelId, roleId }) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guild.id) return { ok: false, error: 'panel-missing' };
  if (panel.staffRoleIds.includes(roleId)) return { ok: false, error: 'role-already-added' };

  const limit = await limitFor(guild.id, 'staffRoles');
  if (panel.staffRoleIds.length >= limit) return { ok: false, error: 'limit' };

  const updated = await prisma.panel.update({
    where: { id: panelId },
    data: { staffRoleIds: [...panel.staffRoleIds, roleId] }
  });

  await syncAddedStaffRole(guild, updated, roleId);
  return { ok: true, panel: updated };
}

async function removeStaffRole({ guild, panelId, roleId }) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guild.id) return { ok: false, error: 'panel-missing' };
  if (!panel.staffRoleIds.includes(roleId)) return { ok: false, error: 'role-not-found' };
  if (panel.staffRoleIds.length <= 1) return { ok: false, error: 'last-role' };

  const updated = await prisma.panel.update({
    where: { id: panelId },
    data: { staffRoleIds: panel.staffRoleIds.filter(id => id !== roleId) }
  });

  await syncRemovedStaffRole(guild, panel, roleId);
  return { ok: true, panel: updated };
}

async function addPanelCategory({ guild, panelId, categoryId }) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guild.id) return { ok: false, error: 'panel-missing' };
  if (panel.categoryIds.includes(categoryId)) return { ok: false, error: 'category-already-added' };

  const limit = await limitFor(guild.id, 'panelCategories');
  if (panel.categoryIds.length >= limit) return { ok: false, error: 'limit' };

  const updated = await prisma.panel.update({
    where: { id: panelId },
    data: { categoryIds: [...panel.categoryIds, categoryId] }
  });

  return { ok: true, panel: updated };
}

async function removePanelCategory({ guild, panelId, categoryId }) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guild.id) return { ok: false, error: 'panel-missing' };
  if (!panel.categoryIds.includes(categoryId)) return { ok: false, error: 'category-not-found' };
  if (panel.categoryIds.length <= 1) return { ok: false, error: 'last-category' };

  const updated = await prisma.panel.update({
    where: { id: panelId },
    data: { categoryIds: panel.categoryIds.filter(id => id !== categoryId) }
  });

  return { ok: true, panel: updated };
}

function pickCategoryForTicket(guild, panel) {
  let best = null;
  let bestCount = Infinity;

  for (const categoryId of panel.categoryIds) {
    const category = guild.channels.cache.get(categoryId);
    if (!category) continue;

    const count = guild.channels.cache.filter(channel => channel.parentId === categoryId).size;
    if (count < 50 && count < bestCount) {
      best = categoryId;
      bestCount = count;
    }
  }

  return best;
}

async function addQuestion(guildId, panelId, question) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };

  const limit = await limitFor(guildId, 'formQuestions');
  if (panel.questions.length >= limit) return { ok: false, error: 'limit' };

  const updated = await prisma.panel.update({
    where: { id: panelId },
    data: { questions: [...panel.questions, question] }
  });

  return { ok: true, panel: updated };
}

async function removeQuestion(guildId, panelId, index) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return { ok: false, error: 'panel-missing' };
  if (index < 0 || index >= panel.questions.length) return { ok: false, error: 'question-missing' };

  const questions = [...panel.questions];
  questions.splice(index, 1);

  const updated = await prisma.panel.update({ where: { id: panelId }, data: { questions } });
  return { ok: true, panel: updated };
}

async function openTicket({ guild, member, panelId, answers }) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel) return { ok: false, error: 'panel-missing' };

  const existing = await prisma.ticket.findFirst({
    where: { panelId, openerId: member.id, status: 'open' }
  });
  if (existing) return { ok: false, error: 'already-open' };

  const activeLimit = await limitFor(guild.id, 'activeTickets');
  const activeCount = await countActiveTickets(guild.id);
  if (activeCount >= activeLimit) return { ok: false, error: 'limit' };

  const categoryId = pickCategoryForTicket(guild, panel);
  if (!categoryId) return { ok: false, error: 'no-category-room' };

  const guildRow = await prisma.guild.upsert({
    where: { id: guild.id },
    update: { ticketCounter: { increment: 1 } },
    create: { id: guild.id, ticketCounter: 1 }
  });

  const number = guildRow.ticketCounter;
  const channelName = `${TICKET_CHANNEL_PREFIX}-${String(number).padStart(4, '0')}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        ...panel.staffRoleIds.map(roleId => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        }))
      ]
    });
  } catch (err) {
    return { ok: false, error: 'channel-create-failed' };
  }

  const ticket = await prisma.ticket.create({
    data: { guildId: guild.id, panelId, channelId: channel.id, number, openerId: member.id }
  });

  await channel.send(buildTicketWelcomeMessage(ticket, panel, member, answers || []));

  return { ok: true, ticket, channel };
}

async function generateTranscript(channel) {
  const lines = [];
  let lastId;

  for (let batch = 0; batch < TRANSCRIPT_FETCH_BATCHES; batch += 1) {
    const options = lastId ? { limit: 100, before: lastId } : { limit: 100 };
    const fetched = await channel.messages.fetch(options);
    if (!fetched.size) break;

    for (const message of fetched.values()) {
      lines.push(`[${message.createdAt.toISOString()}] ${message.author.tag}: ${message.content}`);
    }

    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }

  return lines.reverse().join('\n');
}

async function closeTicket({ ticket, channel, closerId }) {
  if (ticket.status === 'closed') return { ok: false, error: 'closed' };

  const panel = await prisma.panel.findUnique({ where: { id: ticket.panelId } });
  const transcript = await generateTranscript(channel);

  if (panel && panel.transcriptChannelId) {
    const transcriptChannel = channel.guild.channels.cache.get(panel.transcriptChannelId);
    if (transcriptChannel) {
      const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `${channel.name}.txt` });
      await transcriptChannel
        .send({ content: `${em.transcript} Transcript for ${channel.name} (closed by <@${closerId}>)`, files: [attachment] })
        .catch(() => {});
    }
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'closed', closedAt: new Date(), closedBy: closerId }
  });

  await channel.send(v2Message([`## Ticket Closed`, SEPARATOR, `Closed by <@${closerId}>. This channel will be deleted shortly.`]));

  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 5000);

  return { ok: true };
}

async function claimTicket({ ticket, actorId }) {
  if (ticket.status === 'closed') return { ok: false, error: 'closed' };
  if (ticket.claimedBy) return { ok: false, error: 'already-claimed' };

  await prisma.ticket.update({ where: { id: ticket.id }, data: { claimedBy: actorId } });
  return { ok: true };
}

async function releaseTicket({ ticket }) {
  if (!ticket.claimedBy) return { ok: false, error: 'not-claimed' };

  await prisma.ticket.update({ where: { id: ticket.id }, data: { claimedBy: null } });
  return { ok: true };
}

async function addMember({ channel, userId }) {
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });
  return { ok: true };
}

async function removeMember({ channel, userId }) {
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: false,
    SendMessages: false
  });
  return { ok: true };
}

async function renameTicket({ channel, name }) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
  if (!sanitized) return { ok: false, error: 'invalid-name' };

  await channel.setName(sanitized);
  return { ok: true, name: sanitized };
}

async function handleOpenButton(interaction) {
  const panelId = interaction.customId.slice('ticket_open_'.length);
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });

  if (!panel) {
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  if (panel.questions.length) {
    startSession(interaction.user.id, panelId);
    await interaction.showModal(buildTicketModal(panel, 0));
    return;
  }

  await interaction.reply(v2Message([`${em.loading} Creating your ticket...`], { ephemeral: true }));
  const result = await openTicket({ guild: interaction.guild, member: interaction.member, panelId });

  if (!result.ok) {
    await interaction.followUp(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.followUp(v2Message([`${em.success} Ticket opened: ${result.channel}`], { ephemeral: true }));
}

async function handleTicketModalSubmit(interaction) {
  const match = interaction.customId.match(/^ticket_modal_(.+)_(\d+)$/);
  if (!match) return;

  const [, panelId, pageRaw] = match;
  const page = Number(pageRaw);
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });

  if (!panel) {
    clearSession(interaction.user.id, panelId);
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  const pageQuestions = panel.questions.slice(page * MODAL_PAGE_SIZE, page * MODAL_PAGE_SIZE + MODAL_PAGE_SIZE);
  const entries = pageQuestions.map((question, offset) => {
    const globalIndex = page * MODAL_PAGE_SIZE + offset;
    return { index: globalIndex, question, answer: interaction.fields.getTextInputValue(`question_${globalIndex}`) };
  });
  recordAnswers(interaction.user.id, panelId, entries);

  const totalPages = Math.ceil(panel.questions.length / MODAL_PAGE_SIZE);
  const nextPage = page + 1;

  if (nextPage < totalPages) {
    const answeredSoFar = page * MODAL_PAGE_SIZE + pageQuestions.length;
    await interaction.reply(
      v2Message(
        [`${em.success} Saved questions ${answeredSoFar - pageQuestions.length + 1}-${answeredSoFar} of ${panel.questions.length}.`, 'Click continue for the next set of questions.'],
        { ephemeral: true, extraComponents: [buildModalContinueRow(panel, nextPage)] }
      )
    );
    return;
  }

  await interaction.reply(v2Message([`${em.loading} Creating your ticket...`], { ephemeral: true }));
  const answers = getAnswers(interaction.user.id, panelId);
  clearSession(interaction.user.id, panelId);

  const result = await openTicket({ guild: interaction.guild, member: interaction.member, panelId, answers });

  if (!result.ok) {
    await interaction.followUp(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.followUp(v2Message([`${em.success} Ticket opened: ${result.channel}`], { ephemeral: true }));
}

async function handleModalContinueButton(interaction) {
  const match = interaction.customId.match(/^ticket_modal_continue_(.+)_(\d+)$/);
  if (!match) return;

  const [, panelId, pageRaw] = match;
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });

  if (!panel) {
    clearSession(interaction.user.id, panelId);
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
    return;
  }

  await interaction.showModal(buildTicketModal(panel, Number(pageRaw)));
}

async function handleClaimButton(interaction) {
  const ticketId = interaction.customId.slice('ticket_claim_'.length);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    await interaction.reply(v2Message([`${em.error} Ticket not found.`], { ephemeral: true }));
    return;
  }

  const panel = await prisma.panel.findUnique({ where: { id: ticket.panelId } });
  if (!isStaffMember(interaction.member, panel)) {
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`], { ephemeral: true }));
    return;
  }

  const result = await claimTicket({ ticket, actorId: interaction.user.id });
  if (!result.ok) {
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.reply(v2Message([`${em.success} Ticket claimed by <@${interaction.user.id}>.`]));
}

async function handleCloseButton(interaction) {
  const ticketId = interaction.customId.slice('ticket_close_'.length);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    await interaction.reply(v2Message([`${em.error} Ticket not found.`], { ephemeral: true }));
    return;
  }

  const panel = await prisma.panel.findUnique({ where: { id: ticket.panelId } });
  const isOpener = ticket.openerId === interaction.user.id;

  if (!isStaffMember(interaction.member, panel) && !isOpener) {
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`], { ephemeral: true }));
    return;
  }

  const result = await closeTicket({ ticket, channel: interaction.channel, closerId: interaction.user.id });
  if (!result.ok) {
    await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
    return;
  }

  await interaction.reply(v2Message([`${em.success} Closing ticket...`]));
}

module.exports = {
  limitFor,
  countPanels,
  countActiveTickets,
  listPanels,
  getTicketContext,
  isStaffMember,
  buildPanelMessage,
  buildTicketWelcomeMessage,
  createPanel,
  postPanelMessage,
  deletePanel,
  setTranscriptChannel,
  addStaffRole,
  removeStaffRole,
  addPanelCategory,
  removePanelCategory,
  addQuestion,
  removeQuestion,
  openTicket,
  closeTicket,
  claimTicket,
  releaseTicket,
  addMember,
  removeMember,
  renameTicket,
  handleOpenButton,
  handleTicketModalSubmit,
  handleModalContinueButton,
  handleClaimButton,
  handleCloseButton
};
