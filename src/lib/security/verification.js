const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags
} = require('discord.js');
const crypto = require('crypto');
const { createCanvas } = require('@napi-rs/canvas');
const prisma = require('../db');
const { v2Message } = require('../components');
const { loadConfig, setRaw, isMemberTrusted, addTimer, cancelTimer } = require('./store');
const { punish, quarantineMember } = require('./punish');
const { securityLog } = require('./alerts');
const { em } = require('../emojis');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sessions = new Map();
const DAY = 24 * 60 * 60 * 1000;

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function makeCaptcha(length, difficulty) {
  const width = 320;
  const height = 110;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const noise = { easy: 60, medium: 160, hard: 320 }[difficulty] || 160;
  const lines = { easy: 3, medium: 6, hard: 11 }[difficulty] || 6;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1b1f33');
  gradient.addColorStop(1, '#2a2350');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < noise; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  }

  let code = '';
  const step = (width - 40) / length;
  for (let i = 0; i < length; i += 1) {
    const char = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    code += char;
    ctx.save();
    ctx.translate(30 + i * step + step / 2 - 10, height / 2 + 14 + (Math.random() * 14 - 7));
    ctx.rotate((Math.random() - 0.5) * (difficulty === 'hard' ? 0.9 : 0.5));
    ctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 70%, 75%)`;
    ctx.font = `bold ${40 + Math.floor(Math.random() * 10)}px sans-serif`;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  for (let i = 0; i < lines; i += 1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  return { code, buffer: canvas.encode('png') };
}

function isConfigured(config) {
  return Boolean(config.enabled && (config.verifiedRoleId || config.unverifiedRoleId));
}

async function grantVerification(member, via) {
  const config = (await loadConfig(member.guild.id)).verification;
  const reason = `Quonex verification (${via})`;
  if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) await member.roles.remove(config.unverifiedRoleId, reason).catch(() => {});
  if (config.verifiedRoleId && !member.roles.cache.has(config.verifiedRoleId)) await member.roles.add(config.verifiedRoleId, reason).catch(() => {});
  await cancelTimer(member.guild.id, 'verify-timeout', member.id);
  sessions.delete(sessionKey(member.guild.id, member.id));

  if (config.logSuccess) {
    await securityLog(member.guild, { module: 'verification', action: 'member verified', targetId: member.id, lines: [`Method: ${via}.`] });
  }
}

async function requireVerification(member, reason) {
  const guild = member.guild;
  const config = (await loadConfig(guild.id)).verification;
  if (!isConfigured(config) || !config.unverifiedRoleId) return false;
  if (config.verifiedRoleId && member.roles.cache.has(config.verifiedRoleId)) return true;

  const role = guild.roles.cache.get(config.unverifiedRoleId);
  if (!role) return false;
  await member.roles.add(role, `Verification required: ${reason}`).catch(() => {});

  if (config.timeLimitMinutes > 0) {
    await addTimer({
      guildId: guild.id,
      kind: 'verify-timeout',
      targetId: member.id,
      expiresAt: new Date(Date.now() + config.timeLimitMinutes * 60 * 1000)
    });
  }

  if (config.dmOnJoin) {
    const where = config.panelChannelId ? `<#${config.panelChannelId}>` : 'the verification channel';
    await member
      .send(v2Message([`Welcome to **${guild.name}**!`, `To get access, verify in ${where}.`], { footer: false }))
      .catch(() => {});
  }
  return true;
}

async function failVerification(guild, userId, reason) {
  const config = (await loadConfig(guild.id)).verification;
  const result = await punish({
    guild,
    userId,
    action: config.failAction,
    reason: `Verification: ${reason}`,
    timeoutMinutes: config.failTimeoutMinutes
  });
  await securityLog(guild, {
    module: 'verification',
    action: 'verification failed',
    severity: 'warning',
    targetId: userId,
    lines: [reason, `Applied **${result.applied}**${result.ok ? '' : ` (failed: ${result.error})`}.`]
  });
}

async function handleJoin(member) {
  if (member.user.bot) return;
  const config = (await loadConfig(member.guild.id)).verification;
  if (!isConfigured(config) || !config.unverifiedRoleId) return;
  if (await isMemberTrusted(member, 'verification')) return;

  if (config.scope === 'suspicious' && Date.now() - member.user.createdTimestamp >= config.suspiciousAgeDays * DAY) return;
  await requireVerification(member, 'joined the server');
}

function panelPayload(config) {
  const color = /^#[0-9a-f]{6}$/i.test(config.panelColor) ? parseInt(config.panelColor.slice(1), 16) : 0x6f5de0;
  const container = new ContainerBuilder().setAccentColor(color);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${config.panelTitle}\n${config.panelText}`));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sec:verify:start').setLabel(config.panelButton.slice(0, 80)).setStyle(ButtonStyle.Success)
    )
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function postPanel(guild, channel) {
  const config = (await loadConfig(guild.id)).verification;
  if (config.panelChannelId && config.panelMessageId) {
    const oldChannel = guild.channels.cache.get(config.panelChannelId);
    const old = oldChannel ? await oldChannel.messages.fetch(config.panelMessageId).catch(() => null) : null;
    if (old) await old.delete().catch(() => {});
  }
  const sent = await channel.send(panelPayload(config));
  await setRaw(guild.id, 'verification', 'panelChannelId', channel.id);
  await setRaw(guild.id, 'verification', 'panelMessageId', sent.id);
  return sent;
}

function answerModal(config) {
  const label = config.mode === 'passphrase' ? 'Type the phrase' : 'Type the code from the image';
  return new ModalBuilder()
    .setCustomId('sec:verify:modal')
    .setTitle('Verification')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('answer').setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      )
    );
}

function captchaReply(guild, userId, config, note) {
  const { code, buffer } = makeCaptcha(config.captchaLength, config.captchaDifficulty);
  const key = sessionKey(guild.id, userId);
  const previous = sessions.get(key);
  sessions.set(key, { code, attempts: previous ? previous.attempts : 0, expires: Date.now() + 10 * 60 * 1000 });

  const container = new ContainerBuilder().setAccentColor(0x6f5de0);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${note ? `${note}\n` : ''}Read the code in the image, then press **Enter code**.`));
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://captcha.png')));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sec:verify:answer').setLabel('Enter code').setStyle(ButtonStyle.Primary))
  );

  return {
    components: [container],
    files: [new AttachmentBuilder(buffer, { name: 'captcha.png' })],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  };
}

async function handleVerifyButton(interaction) {
  const guild = interaction.guild;
  const config = (await loadConfig(guild.id)).verification;
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  if (!isConfigured(config) || !member) {
    await interaction.reply(v2Message(['Verification is not set up right now.'], { ephemeral: true, footer: false }));
    return;
  }

  const verified = config.verifiedRoleId ? member.roles.cache.has(config.verifiedRoleId) : !member.roles.cache.has(config.unverifiedRoleId);
  if (verified) {
    await interaction.reply(v2Message(['You are already verified.'], { ephemeral: true, footer: false }));
    return;
  }

  if (interaction.customId === 'sec:verify:answer') {
    const session = sessions.get(sessionKey(guild.id, member.id));
    if (config.mode === 'captcha' && (!session || session.expires < Date.now())) {
      await interaction.reply(captchaReply(guild, member.id, config, 'That code expired. Here is a new one.'));
      return;
    }
    await interaction.showModal(answerModal(config));
    return;
  }

  if (config.mode === 'web') {
    await sendWebLink(interaction, member, config);
    return;
  }

  if (config.mode === 'button') {
    await grantVerification(member, 'button');
    await interaction.reply(v2Message([`${em.success} You are verified. Welcome in!`], { ephemeral: true, footer: false }));
    return;
  }

  if (config.mode === 'passphrase') {
    await interaction.showModal(answerModal(config));
    return;
  }

  await interaction.reply(captchaReply(guild, member.id, config));
}

function dashboardUrl() {
  const raw = process.env.DASHBOARD_URL || process.env.AUTH_URL || '';
  return raw.replace(/\/+$/, '');
}

async function sendWebLink(interaction, member, config) {
  const base = dashboardUrl();
  if (!base) {
    await interaction.reply(v2Message([`${em.error} Web verification is not available yet. Ask an admin to set up the dashboard link.`], { ephemeral: true, footer: false }));
    return;
  }

  const guild = interaction.guild;
  await prisma.webVerifySession.deleteMany({ where: { guildId: guild.id, userId: member.id, usedAt: null } });
  const token = crypto.randomBytes(24).toString('base64url');
  await prisma.webVerifySession.create({
    data: { guildId: guild.id, userId: member.id, token, expiresAt: new Date(Date.now() + config.webLinkMinutes * 60 * 1000) }
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Verify on the web').setStyle(ButtonStyle.Link).setURL(`${base}/verify/${guild.id}?t=${token}`)
  );
  await interaction.reply(
    v2Message(
      ['**Verify on the web**', `Open the link, sign in with Discord and press verify. It works for ${config.webLinkMinutes} minutes and only for your account.`, '-# Your IP address is checked for VPNs and stored only as a one-way hash so staff can spot alt accounts.'],
      { ephemeral: true, footer: false, extraComponents: [row] }
    )
  );
}

async function applyWebResult(guild, body) {
  const config = (await loadConfig(guild.id)).verification;
  const member = await guild.members.fetch(body.userId).catch(() => null);
  if (!member) return { ok: false, error: 'member-missing' };

  const verified = config.verifiedRoleId ? member.roles.cache.has(config.verifiedRoleId) : config.unverifiedRoleId ? !member.roles.cache.has(config.unverifiedRoleId) : false;
  let outcome = ['grant', 'flag', 'quarantine', 'block'].includes(body.outcome) ? body.outcome : 'block';
  const trusted = await isMemberTrusted(member, 'verification');
  if (trusted) outcome = 'grant';

  const reasons = Array.isArray(body.reasons) ? body.reasons : [];
  const lines = reasons.map(item => {
    if (item.type === 'vpn') return `VPN or proxy detected (${item.detail}).`;
    if (item.type === 'country') return `Country not allowed: ${item.detail}.`;
    return `Shares ${(item.alts || []).some(alt => alt.by === 'device') ? 'a device or connection' : 'a connection'} with: ${(item.alts || []).slice(0, 5).map(alt => `<@${String(alt.userId).replace(/\D/g, '')}> (${alt.by})`).join(', ')}.`;
  });
  if (body.country) lines.push(`Country: ${String(body.country).toUpperCase()}.`);

  if (outcome === 'grant' || outcome === 'flag') {
    if (!verified) await grantVerification(member, 'web');
    if (outcome === 'flag') {
      await securityLog(guild, { module: 'verification', action: 'web verification flagged', severity: 'warning', targetId: member.id, lines: [...lines, 'Verified, but worth a look.'] });
    }
    return { ok: true, final: outcome };
  }

  if (outcome === 'quarantine') {
    await cancelTimer(guild.id, 'verify-timeout', member.id);
    await quarantineMember(guild, member, 'Web verification flagged this account', null).catch(() => {});
    await securityLog(guild, { module: 'verification', action: 'web verification quarantined a member', severity: 'critical', targetId: member.id, lines });
    return { ok: true, final: 'quarantine' };
  }

  await securityLog(guild, { module: 'verification', action: 'web verification blocked', severity: 'warning', targetId: member.id, lines });
  return { ok: true, final: 'block' };
}

async function handleVerifyModal(interaction) {
  const guild = interaction.guild;
  const config = (await loadConfig(guild.id)).verification;
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!isConfigured(config) || !member) {
    await interaction.reply(v2Message(['Verification is not set up right now.'], { ephemeral: true, footer: false }));
    return;
  }

  const answer = interaction.fields.getTextInputValue('answer').trim();
  const key = sessionKey(guild.id, member.id);
  const session = sessions.get(key) || { code: '', attempts: 0, expires: 0 };

  const correct =
    config.mode === 'passphrase'
      ? config.passphrase && answer.toLowerCase() === config.passphrase.toLowerCase()
      : session.expires > Date.now() && answer.toUpperCase() === session.code;

  if (correct) {
    await grantVerification(member, config.mode);
    await interaction.reply(v2Message([`${em.success} You are verified. Welcome in!`], { ephemeral: true, footer: false }));
    return;
  }

  session.attempts += 1;
  sessions.set(key, session);

  if (session.attempts >= config.maxAttempts) {
    sessions.delete(key);
    await interaction.reply(v2Message([`${em.error} Too many wrong answers.`], { ephemeral: true, footer: false }));
    await failVerification(guild, member.id, `${config.maxAttempts} wrong answers`);
    return;
  }

  const left = config.maxAttempts - session.attempts;
  if (config.mode === 'captcha') {
    await interaction.reply(captchaReply(guild, member.id, config, `${em.error} Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.`));
    return;
  }
  await interaction.reply(v2Message([`${em.error} Wrong phrase. ${left} attempt${left === 1 ? '' : 's'} left. Press the verify button again.`], { ephemeral: true, footer: false }));
}

async function handleVerifyTimeout(guild, userId) {
  const config = (await loadConfig(guild.id)).verification;
  if (!isConfigured(config)) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const verified = config.verifiedRoleId ? member.roles.cache.has(config.verifiedRoleId) : !member.roles.cache.has(config.unverifiedRoleId);
  if (verified) return;
  await failVerification(guild, userId, `did not verify within ${config.timeLimitMinutes} minutes`);
}

module.exports = {
  requireVerification,
  grantVerification,
  handleJoin,
  handleVerifyButton,
  handleVerifyModal,
  handleVerifyTimeout,
  applyWebResult,
  postPanel,
  isConfigured
};
