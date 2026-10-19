const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const store = require('./store');
const { ensureQuarantineRole } = require('./punish');
const { createBackup } = require('./backup');
const { securityLog } = require('./alerts');
const { em } = require('../emojis');

const CATEGORY_NAME = 'Quonex Security';

const CHANNELS = [
  { key: 'security', name: 'security-logs', topic: 'Anti-nuke, anti-raid, auto-mod and verification events.', targets: [['core', 'logChannelId']] },
  { key: 'mod', name: 'mod-logs', topic: 'Moderation cases: bans, kicks, timeouts and warnings.', targets: [['moderation', 'logChannelId']] },
  { key: 'messages', name: 'message-logs', topic: 'Edited, deleted and purged messages, plus ghost pings.', targets: [['moderation', 'msgLogChannelId']] },
  { key: 'queue', name: 'appeals-and-reports', topic: 'Ban appeals, message reports and watchlist alerts.', targets: [['moderation', 'appealChannelId'], ['moderation', 'reportChannelId'], ['moderation', 'watchChannelId']] }
];

const REQUIRED = [
  ['Manage Channels', P.ManageChannels],
  ['Manage Roles', P.ManageRoles],
  ['View Audit Log', P.ViewAuditLog],
  ['Ban Members', P.BanMembers],
  ['Kick Members', P.KickMembers],
  ['Timeout Members', P.ModerateMembers],
  ['Manage Messages', P.ManageMessages]
];

function missingPermissions(guild) {
  const me = guild.members.me;
  return REQUIRED.filter(([, bit]) => !me.permissions.has(bit)).map(([name]) => name);
}

function existingChannel(guild, config, spec) {
  for (const [module, key] of spec.targets) {
    const id = config[module] && config[module][key];
    const channel = id ? guild.channels.cache.get(id) : null;
    if (channel && channel.isTextBased()) return channel;
  }
  return null;
}

async function privateCategory(guild, staffRole) {
  const found = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name === CATEGORY_NAME);
  if (found) return found;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: guild.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.ManageChannels] }
  ];
  if (staffRole) overwrites.push({ id: staffRole.id, allow: [P.ViewChannel, P.ReadMessageHistory] });
  return guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Quonex security setup' });
}

async function createChannels(guild, staffRole, wanted, steps) {
  const config = await store.loadConfig(guild.id);
  const made = {};
  let category = null;

  for (const spec of CHANNELS.filter(item => wanted.includes(item.key))) {
    const found = existingChannel(guild, config, spec);
    if (found) {
      made[spec.key] = found;
      steps.push({ ok: true, text: `${spec.name}: kept <#${found.id}>` });
      continue;
    }
    if (!guild.members.me.permissions.has(P.ManageChannels)) {
      steps.push({ ok: false, text: `${spec.name}: I need Manage Channels to create it` });
      continue;
    }
    try {
      if (!category) category = await privateCategory(guild, staffRole);
      const channel = await guild.channels.create({ name: spec.name, type: ChannelType.GuildText, parent: category.id, topic: spec.topic, reason: 'Quonex security setup' });
      made[spec.key] = channel;
      steps.push({ ok: true, text: `${spec.name}: created <#${channel.id}>` });
    } catch {
      steps.push({ ok: false, text: `${spec.name}: Discord refused to create it` });
    }
  }

  for (const spec of CHANNELS) {
    const channel = made[spec.key];
    if (!channel) continue;
    for (const [module, key] of spec.targets) {
      const current = config[module] && config[module][key];
      if (!current || !guild.channels.cache.get(current)) await store.setRaw(guild.id, module, key, channel.id);
    }
  }
}

async function runFullSetup({ guild, user, custom, presetName, staffRole, createLogChannels, wantedChannels, quarantine, backup, logChannel, moderation, autoBackupHours }) {
  const steps = [];
  const missing = missingPermissions(guild);
  if (missing.length) steps.push({ ok: false, text: `I am missing: ${missing.join(', ')}. Some features will not work until I have them.` });

  await store.applyPreset(guild.id, custom);
  steps.push({ ok: true, text: `Anti-nuke, anti-raid and auto-mod configured (based on **${presetName}**)` });

  if (logChannel) {
    await store.setRaw(guild.id, 'core', 'logChannelId', logChannel);
    steps.push({ ok: true, text: `Security log: <#${logChannel}>` });
  }
  if (createLogChannels) await createChannels(guild, staffRole, wantedChannels, steps);

  for (const [key, value] of Object.entries(moderation || {})) await store.setRaw(guild.id, 'moderation', key, value);
  steps.push({ ok: true, text: 'Moderation: appeals, reports, warnings and protection rules configured' });

  if (quarantine) {
    try {
      const role = await ensureQuarantineRole(guild);
      steps.push({ ok: true, text: `Quarantine role: <@&${role.id}>` });
    } catch {
      steps.push({ ok: false, text: 'Quarantine role could not be created (needs Manage Roles)' });
    }
  }

  if (autoBackupHours !== undefined) {
    await store.setRaw(guild.id, 'core', 'autoBackupHours', autoBackupHours);
    steps.push({ ok: true, text: autoBackupHours ? `Automatic backups every ${autoBackupHours} hours` : 'Automatic backups off' });
  }

  if (backup) {
    try {
      await createBackup(guild, { name: 'Baseline after security setup', by: user.id });
      steps.push({ ok: true, text: 'Baseline backup of roles and channels saved' });
    } catch {
      steps.push({ ok: false, text: 'Baseline backup failed' });
    }
  }

  const mine = guild.members.me.roles.highest.position;
  const manual = [
    'Add trusted bots and admins with `/security whitelist add` so they are never punished.',
    'Run `/tempvoice setup` for join-to-create voice rooms.'
  ];
  if (guild.roles.cache.some(role => !role.managed && role.id !== guild.id && role.position > mine)) {
    manual.unshift('Move my role near the top of the role list, above the roles I should be able to punish.');
  }

  await securityLog(guild, { module: 'core', action: `guided setup applied (${presetName})`, executorId: user.id });
  return { steps, manual, ok: em.success };
}

module.exports = { runFullSetup, missingPermissions, CHANNELS, CATEGORY_NAME };
