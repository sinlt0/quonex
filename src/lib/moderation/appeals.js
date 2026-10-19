const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const prisma = require('../db');
const { loadConfig } = require('../security/store');
const { v2Message, SEPARATOR } = require('../components');
const engine = require('./engine');
const { em } = require('../emojis');

async function nextNumber(guildId) {
  const row = await prisma.modCounter.upsert({
    where: { guildId },
    update: { lastAppeal: { increment: 1 } },
    create: { guildId, lastAppeal: 1 }
  });
  return row.lastAppeal;
}

function clip(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function quote(text) {
  return clip(text, 1500)
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

function reviewRow(appeal) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap:ok:${appeal.id}`).setLabel('Approve and unban').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap:no:${appeal.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
  );
}

function renderAppeal(appeal, caseRow) {
  const lines = [`### ${em.modCase} Ban appeal #${appeal.number}`, `**User:** <@${appeal.userId}> (\`${appeal.userId}\`)`];
  if (caseRow) lines.push(`**Ban:** case #${caseRow.caseNumber} · ${caseRow.reason || 'No reason given'}`);
  lines.push(SEPARATOR, quote(appeal.text));
  if (appeal.status === 'pending') return v2Message(lines, { footer: false, extraComponents: [reviewRow(appeal)], allowedMentions: { parse: [] } });
  const verdict = appeal.status === 'approved' ? `${em.on} Approved` : `${em.alert} Denied`;
  lines.push(SEPARATOR, `${verdict} by <@${appeal.reviewerId}>${appeal.reviewNote ? `: ${appeal.reviewNote}` : ''}`);
  return v2Message(lines, { footer: false, allowedMentions: { parse: [] } });
}

async function latestBanCase(guildId, userId) {
  return prisma.modCase.findFirst({ where: { guildId, userId, action: { in: ['ban', 'tempban'] } }, orderBy: { caseNumber: 'desc' } });
}

async function destination(guild, config) {
  const core = (await loadConfig(guild.id)).core;
  const id = config.appealChannelId || config.logChannelId || core.logChannelId;
  const channel = id ? guild.channels.cache.get(id) : null;
  return channel && channel.isTextBased() ? channel : null;
}

async function eligibility(guild, userId, config) {
  if (!config.appealsEnabled) return 'Appeals are turned off on this server.';
  const ban = await guild.bans.fetch(userId).catch(() => null);
  if (!ban) return 'You are not banned from this server.';
  const last = await prisma.modAppeal.findFirst({ where: { guildId: guild.id, userId }, orderBy: { createdAt: 'desc' } });
  if (last && last.status === 'pending') return 'You already have an appeal waiting for review.';
  if (last && config.appealCooldownDays) {
    const until = (last.resolvedAt || last.createdAt).getTime() + config.appealCooldownDays * 86400000;
    if (until > Date.now()) return `You can appeal again <t:${Math.floor(until / 1000)}:R>.`;
  }
  return null;
}

function replyTo(interaction, lines) {
  const payload = v2Message(lines, { ephemeral: true, footer: false });
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
}

async function startAppeal(interaction, guildId) {
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) return replyTo(interaction, [`${em.alert} I can no longer reach that server.`]);
  const config = (await loadConfig(guildId)).moderation;
  const problem = await eligibility(guild, interaction.user.id, config);
  if (problem) return replyTo(interaction, [`${em.alert} ${problem}`]);
  const modal = new ModalBuilder()
    .setCustomId(`ap:modal:${guildId}`)
    .setTitle(clip(`Appeal: ${guild.name}`, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('text').setLabel('Why should the ban be lifted?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(config.appealMinChars).setMaxLength(1000)
      )
    );
  return interaction.showModal(modal);
}

async function submitAppeal(interaction, guildId) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) return replyTo(interaction, [`${em.alert} I can no longer reach that server.`]);
  const config = (await loadConfig(guildId)).moderation;
  const problem = await eligibility(guild, interaction.user.id, config);
  if (problem) return replyTo(interaction, [`${em.alert} ${problem}`]);
  const channel = await destination(guild, config);
  if (!channel) return replyTo(interaction, [`${em.alert} This server has not set up appeals yet.`]);

  const text = interaction.fields.getTextInputValue('text').trim();
  const caseRow = await latestBanCase(guildId, interaction.user.id);
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const number = await nextNumber(guildId);
  let appeal = await prisma.modAppeal.create({ data: { guildId, number, userId: interaction.user.id, caseNumber: caseRow ? caseRow.caseNumber : null, text } });

  const sent = await channel.send(renderAppeal(appeal, caseRow)).catch(() => null);
  if (!sent) {
    await prisma.modAppeal.delete({ where: { id: appeal.id } });
    return replyTo(interaction, [`${em.alert} I could not deliver your appeal. Try again later.`]);
  }
  appeal = await prisma.modAppeal.update({ where: { id: appeal.id }, data: { channelId: channel.id, messageId: sent.id } });
  return replyTo(interaction, [`${em.on} Your appeal was sent. You will get a DM when staff decide.`]);
}

async function resolveAppeal(interaction, appealId, verdict, note) {
  const appeal = await prisma.modAppeal.findUnique({ where: { id: appealId } });
  if (!appeal || !interaction.guild || appeal.guildId !== interaction.guild.id) return { error: 'Appeal not found.' };
  if (appeal.status !== 'pending') return { error: 'This appeal was already decided.' };
  if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return { error: 'You need the Ban Members permission to review appeals.' };

  if (verdict === 'approved') {
    const result = await engine.unbanUser({ guild: interaction.guild, moderator: interaction.member, userId: appeal.userId, reason: `Appeal #${appeal.number} approved` });
    if (!result.ok && result.error !== 'That user is not banned.') return { error: result.error };
  }

  const updated = await prisma.modAppeal.update({ where: { id: appeal.id }, data: { status: verdict, reviewerId: interaction.user.id, reviewNote: note || null, resolvedAt: new Date() } });
  const caseRow = updated.caseNumber ? await prisma.modCase.findUnique({ where: { guildId_caseNumber: { guildId: updated.guildId, caseNumber: updated.caseNumber } } }) : null;
  const user = await interaction.client.users.fetch(updated.userId).catch(() => null);
  if (user) {
    const lines = verdict === 'approved' ? [`${em.on} Your ban appeal for **${interaction.guild.name}** was approved. You can join the server again.`] : [`${em.alert} Your ban appeal for **${interaction.guild.name}** was denied.`];
    if (note) lines.push(`**Note from staff:** ${note}`);
    await user.send(v2Message(lines, { footer: false })).catch(() => {});
  }
  return { appeal: updated, caseRow };
}

async function reviewAppeal(interaction, verdict, appealId, note) {
  const outcome = await resolveAppeal(interaction, appealId, verdict, note);
  if (outcome.error) return replyTo(interaction, [`${em.alert} ${outcome.error}`]);
  const payload = renderAppeal(outcome.appeal, outcome.caseRow);
  if (interaction.isFromMessage && interaction.isFromMessage()) return interaction.update(payload);
  if (interaction.message) await interaction.message.edit(payload).catch(() => {});
  return replyTo(interaction, [`${em.on} Appeal ${verdict}.`]);
}

async function handleAppealInteraction(interaction) {
  const [, action, value] = interaction.customId.split(':');
  if (interaction.isButton()) {
    if (action === 'start') return startAppeal(interaction, value);
    if (action === 'ok') return reviewAppeal(interaction, 'approved', value);
    if (action === 'no') {
      const appeal = await prisma.modAppeal.findUnique({ where: { id: value } });
      if (!appeal || !interaction.guild || appeal.guildId !== interaction.guild.id) return replyTo(interaction, [`${em.alert} Appeal not found.`]);
      if (appeal.status !== 'pending') return replyTo(interaction, [`${em.alert} This appeal was already decided.`]);
      if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return replyTo(interaction, [`${em.alert} You need the Ban Members permission to review appeals.`]);
      const modal = new ModalBuilder()
        .setCustomId(`ap:nomodal:${value}`)
        .setTitle('Deny appeal')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Message to the user (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
      return interaction.showModal(modal);
    }
    return null;
  }
  if (interaction.isModalSubmit()) {
    if (action === 'modal') return submitAppeal(interaction, value);
    if (action === 'nomodal') {
      const note = interaction.fields.getTextInputValue('note').trim();
      return reviewAppeal(interaction, 'denied', value, note);
    }
  }
  return null;
}

module.exports = { handleAppealInteraction, renderAppeal };
