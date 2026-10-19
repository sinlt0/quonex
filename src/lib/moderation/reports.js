const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits: P } = require('discord.js');
const prisma = require('../db');
const { loadConfig } = require('../security/store');
const { v2Message, SEPARATOR } = require('../components');
const engine = require('./engine');
const { em } = require('../emojis');

const cooldowns = new Map();
const MAX_OPEN_PER_REPORTER = 5;

function clip(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

async function nextNumber(guildId) {
  const row = await prisma.modCounter.upsert({
    where: { guildId },
    update: { lastReport: { increment: 1 } },
    create: { guildId, lastReport: 1 }
  });
  return row.lastReport;
}

function actionRow(report) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rp:delete:${report.id}`).setLabel('Delete message').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rp:warn:${report.id}`).setLabel('Warn').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rp:timeout:${report.id}`).setLabel('Timeout 1h').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rp:ban:${report.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rp:resolve:${report.id}`).setLabel('Resolve').setStyle(ButtonStyle.Success)
  );
}

function renderReport(report, pingRoleId) {
  const link = `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;
  const lines = [`### ${em.modWarn} Report #${report.number}`, `**Message by** <@${report.targetId}> in <#${report.channelId}> · [Jump](${link})`];
  if (report.content) lines.push(clip(report.content, 700).split('\n').map(line => `> ${line}`).join('\n'));
  if (report.attachments) lines.push(`*${report.attachments} attachment${report.attachments === 1 ? '' : 's'}*`);
  lines.push(SEPARATOR, `**Reported by ${report.reporterIds.length}:** ${report.reporterIds.slice(0, 5).map(id => `<@${id}>`).join(' ')}`);
  for (const reason of report.reasons.slice(0, 3)) lines.push(`• ${clip(reason, 200)}`);
  if (report.actions.length) lines.push(SEPARATOR, ...report.actions);
  if (report.status !== 'open') {
    const label = report.status === 'dismissed' ? 'Dismissed' : 'Resolved';
    lines.push(`${em.on} ${label} by <@${report.handlerId}>`);
    return v2Message(lines, { footer: false, allowedMentions: { parse: [] } });
  }
  if (pingRoleId) lines.unshift(`<@&${pingRoleId}>`);
  return v2Message(lines, { footer: false, extraComponents: [actionRow(report)], allowedMentions: { parse: [], roles: pingRoleId ? [pingRoleId] : [] } });
}

async function destination(guild, config) {
  const core = (await loadConfig(guild.id)).core;
  const id = config.reportChannelId || config.logChannelId || core.logChannelId;
  const channel = id ? guild.channels.cache.get(id) : null;
  return channel && channel.isTextBased() ? channel : null;
}

function reportModal(channelId, messageId) {
  return new ModalBuilder()
    .setCustomId(`rp:modal:${channelId}:${messageId}`)
    .setTitle('Report message')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('What is wrong with this message?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(5).setMaxLength(300)
      )
    );
}

async function submitReport(interaction, channelId, messageId) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const config = (await loadConfig(guild.id)).moderation;
  const fail = text => interaction.editReply(v2Message([`${em.alert} ${text}`], { ephemeral: true, footer: false }));
  if (!config.reportsEnabled) return fail('Reports are turned off on this server.');

  const wait = 30000 - (Date.now() - (cooldowns.get(interaction.user.id) || 0));
  if (wait > 0) return fail(`Please wait ${Math.ceil(wait / 1000)}s before sending another report.`);

  const channel = guild.channels.cache.get(channelId);
  const message = channel && channel.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (!message) return fail('That message no longer exists.');
  if (message.author.id === interaction.user.id) return fail('You cannot report your own message.');
  if (message.author.bot) return fail('Bot messages cannot be reported.');

  const target = await prisma.modReport.findUnique({ where: { guildId_messageId: { guildId: guild.id, messageId } } });
  const reason = interaction.fields.getTextInputValue('reason').trim();
  const out = await destination(guild, config);
  if (!out) return fail('This server has not set up a report channel.');

  if (target && target.status !== 'open') return fail('Staff already handled a report for that message.');
  if (target && target.reporterIds.includes(interaction.user.id)) return fail('You already reported that message.');

  const open = await prisma.modReport.count({ where: { guildId: guild.id, status: 'open', reporterIds: { has: interaction.user.id } } });
  if (open >= MAX_OPEN_PER_REPORTER) return fail('You have too many open reports. Wait for staff to review them.');

  cooldowns.set(interaction.user.id, Date.now());
  let report;
  if (target) {
    report = await prisma.modReport.update({ where: { id: target.id }, data: { reporterIds: { push: interaction.user.id }, reasons: { push: reason } } });
    const existing = report.reportChannelId ? guild.channels.cache.get(report.reportChannelId) : null;
    const sent = existing ? await existing.messages.fetch(report.reportMessageId).catch(() => null) : null;
    if (sent) await sent.edit(renderReport(report, config.reportPingRoleId)).catch(() => {});
  } else {
    await prisma.guild.upsert({ where: { id: guild.id }, update: {}, create: { id: guild.id } });
    const number = await nextNumber(guild.id);
    report = await prisma.modReport.create({
      data: {
        guildId: guild.id,
        number,
        reporterIds: [interaction.user.id],
        reasons: [reason],
        targetId: message.author.id,
        channelId,
        messageId,
        content: message.content ? clip(message.content, 700) : null,
        attachments: message.attachments.size
      }
    });
    const sent = await out.send(renderReport(report, config.reportPingRoleId)).catch(() => null);
    if (!sent) {
      await prisma.modReport.delete({ where: { id: report.id } });
      return fail('I could not deliver your report. Try again later.');
    }
    report = await prisma.modReport.update({ where: { id: report.id }, data: { reportChannelId: out.id, reportMessageId: sent.id } });
  }
  return interaction.editReply(v2Message([`${em.on} Thanks, your report was sent to the moderators.`], { ephemeral: true, footer: false }));
}

const NEED = { delete: P.ManageMessages, warn: P.ModerateMembers, timeout: P.ModerateMembers, ban: P.BanMembers, resolve: P.ManageMessages };
const WHAT = { delete: 'Deleted the message', warn: 'Warned the author', timeout: 'Timed the author out for 1h', ban: 'Banned the author' };

async function actOnReport(interaction, action, reportId) {
  const report = await prisma.modReport.findUnique({ where: { id: reportId } });
  const deny = text => interaction.reply(v2Message([`${em.alert} ${text}`], { ephemeral: true, footer: false }));
  if (!report || !interaction.guild || report.guildId !== interaction.guild.id) return deny('Report not found.');
  if (report.status !== 'open') return deny('This report is already closed.');
  if (!NEED[action] || !interaction.memberPermissions.has(NEED[action])) return deny('You do not have permission for that.');

  await interaction.deferUpdate();
  const guild = interaction.guild;
  let line = null;

  if (action === 'delete') {
    const channel = guild.channels.cache.get(report.channelId);
    const message = channel ? await channel.messages.fetch(report.messageId).catch(() => null) : null;
    line = message && (await message.delete().then(() => true, () => false)) ? `${em.on} ${WHAT.delete} (<@${interaction.user.id}>)` : `${em.alert} The message could not be deleted`;
  } else if (action === 'warn' || action === 'timeout' || action === 'ban') {
    const reason = `Report #${report.number}`;
    const base = { guild, moderator: interaction.member, userId: report.targetId, reason };
    const result = action === 'warn' ? await engine.warnUser(base) : action === 'timeout' ? await engine.timeoutUser({ ...base, minutes: 60 }) : await engine.banUser({ ...base, deleteDays: 1 });
    line = result.ok ? `${em.on} ${WHAT[action]} (<@${interaction.user.id}>, case #${result.row.caseNumber})` : `${em.alert} ${result.error}`;
  }

  const data = line ? { actions: { push: line } } : {};
  let updated = await prisma.modReport.update({ where: { id: report.id }, data });
  if (action === 'resolve') {
    const status = updated.actions.length ? 'resolved' : 'dismissed';
    updated = await prisma.modReport.update({ where: { id: report.id }, data: { status, handlerId: interaction.user.id, resolvedAt: new Date() } });
  }
  const config = (await loadConfig(guild.id)).moderation;
  return interaction.message.edit(renderReport(updated, config.reportPingRoleId)).catch(() => {});
}

async function handleReportInteraction(interaction) {
  const [, action, first, second] = interaction.customId.split(':');
  if (interaction.isModalSubmit() && action === 'modal') return submitReport(interaction, first, second);
  if (interaction.isButton()) return actOnReport(interaction, action, first);
  return null;
}

module.exports = { handleReportInteraction, reportModal, renderReport };
