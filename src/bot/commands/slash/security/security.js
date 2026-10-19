const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runWizard } = require('../../../../lib/security/wizard');
const { buildSecurityWizard } = require('../../../../lib/security/wizards/securitySetup');
const prisma = require('../../../../lib/db');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { createBackup, listBackups, deleteBackup, restoreBackup } = require('../../../../lib/security/backup');
const { quarantineMember, releaseMember, ensureQuarantineRole, myTop } = require('../../../../lib/security/punish');
const { startPanic, endPanic, isPanic } = require('../../../../lib/security/antinuke');
const { isRaid } = require('../../../../lib/security/antiraid');
const { securityLog } = require('../../../../lib/security/alerts');
const { MODULES, WHITELIST_MODULES, NUKE_EVENTS, MAX_EXTRA_OWNERS, MAX_WHITELIST_ENTRIES, SECURITY_ERRORS } = require('../../../../config/security');
const { em } = require('../../../../lib/emojis');

const NEEDED = [
  ['ViewAuditLog', 'View Audit Log'],
  ['BanMembers', 'Ban Members'],
  ['KickMembers', 'Kick Members'],
  ['ManageRoles', 'Manage Roles'],
  ['ManageChannels', 'Manage Channels'],
  ['ModerateMembers', 'Timeout Members'],
  ['ManageGuild', 'Manage Server'],
  ['ManageMessages', 'Manage Messages']
];


function data() {
  const builder = new SlashCommandBuilder()
    .setName('security')
    .setDescription('Quonex Shield: security overview, trust system, backups and panic mode')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  builder.addSubcommand(sub => sub.setName('status').setDescription('Check every security module and whether I have the permissions I need'));

  builder.addSubcommand(sub =>
    sub
      .setName('setup')
      .setDescription('Guided setup: asks questions and configures every security feature')
  );

  builder.addSubcommand(sub =>
    sub.setName('logchannel').setDescription('Set where security events are logged').addChannelOption(option => option.setName('channel').setDescription('Log channel (leave empty to turn off)'))
  );

  builder.addSubcommand(sub =>
    sub
      .setName('logs')
      .setDescription('Show recent security events')
      .addStringOption(option => option.setName('module').setDescription('Filter by module').addChoices(...MODULES.map(name => ({ name, value: name }))))
      .addUserOption(option => option.setName('user').setDescription('Only events involving this user'))
      .addIntegerOption(option => option.setName('count').setDescription('How many (default 10)').setMinValue(1).setMaxValue(25))
  );

  builder.addSubcommandGroup(group => {
    kit.addConfigSubcommands(group.setName('config').setDescription('View or change any security setting'), { withModule: true });
    return group;
  });

  builder.addSubcommandGroup(group =>
    group
      .setName('whitelist')
      .setDescription('Global whitelist: users, roles and channels the security system ignores')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Whitelist a user, role or channel')
          .addUserOption(option => option.setName('user').setDescription('User to whitelist'))
          .addRoleOption(option => option.setName('role').setDescription('Role to whitelist'))
          .addChannelOption(option => option.setName('channel').setDescription('Channel to exempt'))
          .addStringOption(option =>
            option
              .setName('module')
              .setDescription('Where the whitelist applies (default: everything, a global whitelist)')
              .addChoices(...WHITELIST_MODULES.map(name => ({ name: name === 'all' ? 'all (global)' : name, value: name })))
          )
          .addStringOption(option => option.setName('event').setDescription('Anti-nuke only: limit to one event').setAutocomplete(true))
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('Remove a whitelist entry')
          .addUserOption(option => option.setName('user').setDescription('User'))
          .addRoleOption(option => option.setName('role').setDescription('Role'))
          .addChannelOption(option => option.setName('channel').setDescription('Channel'))
          .addStringOption(option =>
            option
              .setName('module')
              .setDescription('Remove only this module from the entry (default: delete the whole entry)')
              .addChoices(...WHITELIST_MODULES.map(name => ({ name, value: name })))
          )
      )
      .addSubcommand(sub => sub.setName('list').setDescription('Show the whitelist'))
      .addSubcommand(sub => sub.setName('clear').setDescription('Remove every whitelist entry (trusted only)'))
  );

  builder.addSubcommandGroup(group =>
    group
      .setName('owners')
      .setDescription('Extra owners: trusted admins who can configure security')
      .addSubcommand(sub => sub.setName('add').setDescription('Make someone an extra owner (server owner only)').addUserOption(option => option.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand(sub => sub.setName('remove').setDescription('Remove an extra owner (server owner only)').addUserOption(option => option.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand(sub => sub.setName('list').setDescription('Show the owner and extra owners'))
  );

  builder.addSubcommandGroup(group =>
    group
      .setName('backup')
      .setDescription('Save and restore your roles and channels')
      .addSubcommand(sub => sub.setName('create').setDescription('Take a backup now').addStringOption(option => option.setName('name').setDescription('Backup name').setMaxLength(60)))
      .addSubcommand(sub => sub.setName('list').setDescription('Show saved backups'))
      .addSubcommand(sub =>
        sub
          .setName('restore')
          .setDescription('Recreate roles and channels missing from a backup')
          .addStringOption(option => option.setName('backup').setDescription('Which backup').setAutocomplete(true).setRequired(true))
          .addBooleanOption(option => option.setName('roles').setDescription('Restore roles (default yes)'))
          .addBooleanOption(option => option.setName('channels').setDescription('Restore channels (default yes)'))
      )
      .addSubcommand(sub => sub.setName('delete').setDescription('Delete a backup').addStringOption(option => option.setName('backup').setDescription('Which backup').setAutocomplete(true).setRequired(true)))
  );

  builder.addSubcommandGroup(group =>
    group
      .setName('panic')
      .setDescription('Emergency lockdown of the whole server')
      .addSubcommand(sub =>
        sub
          .setName('start')
          .setDescription('Lock every channel now')
          .addIntegerOption(option => option.setName('minutes').setDescription('How long (default from settings)').setMinValue(1).setMaxValue(1440))
      )
      .addSubcommand(sub => sub.setName('end').setDescription('Unlock everything and end panic mode'))
  );

  builder.addSubcommandGroup(group =>
    group
      .setName('quarantine')
      .setDescription('Isolate members without banning them')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Quarantine a member')
          .addUserOption(option => option.setName('user').setDescription('Member').setRequired(true))
          .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(200))
      )
      .addSubcommand(sub => sub.setName('remove').setDescription('Release a member and restore their roles').addUserOption(option => option.setName('user').setDescription('Member').setRequired(true)))
      .addSubcommand(sub => sub.setName('list').setDescription('Show quarantined members'))
      .addSubcommand(sub => sub.setName('setup').setDescription('Create the quarantine role and lock it out of every channel'))
  );

  return builder;
}

function parseEvents(raw) {
  return (raw || '')
    .split(',')
    .map(item => item.trim())
    .filter(item => NUKE_EVENTS.some(event => event.id === item));
}

function describeEntry(entry) {
  const mention = entry.kind === 'user' ? `<@${entry.targetId}>` : entry.kind === 'role' ? `<@&${entry.targetId}>` : `<#${entry.targetId}>`;
  const scope = entry.modules.includes('all') ? 'everything' : entry.modules.join(', ');
  const events = entry.events.length ? ` · events: ${entry.events.join(', ')}` : '';
  return `${mention} (${entry.kind}) — ${scope}${events}`;
}

async function status(interaction) {
  const guild = interaction.guild;
  const config = await store.loadConfig(guild.id);
  const me = guild.members.me;
  const missing = NEEDED.filter(([flag]) => !me.permissions.has(PermissionFlagsBits[flag])).map(([, label]) => label);
  const owners = await store.listExtraOwners(guild.id);
  const whitelist = await store.listWhitelist(guild.id);
  const quarantined = await prisma.quarantineEntry.count({ where: { guildId: guild.id } });
  const backups = await prisma.securityBackup.count({ where: { guildId: guild.id } });
  const enabledFilters = Object.keys(config.automod).filter(key => key.endsWith('.enabled') && config.automod[key]).length;
  const lines = [
    `## ${em.shield} Quonex Shield`,
    `Anti-nuke: ${kit.onOff(config.antinuke.enabled)} · punishment **${config.antinuke.punishment}**${isPanic(guild.id) ? ` · ${em.error} panic mode active` : ''}`,
    `Anti-raid: ${kit.onOff(config.antiraid.enabled)} · trigger **${config.antiraid.joinThreshold}** joins / **${config.antiraid.joinWindowSeconds}s**${isRaid(guild.id) ? ` · ${em.error} raid mode active` : ''}`,
    `Auto-mod: ${kit.onOff(config.automod.enabled)} · **${enabledFilters}** filters on`,
    `Verification: ${kit.onOff(config.verification.enabled)} · mode **${config.verification.mode}**`,
    `Log channel: ${config.core.logChannelId ? `<#${config.core.logChannelId}>` : '*not set*'}`,
    `Trust: **${owners.length}/${MAX_EXTRA_OWNERS}** extra owners · **${whitelist.length}/${MAX_WHITELIST_ENTRIES}** whitelist entries · strict access ${kit.onOff(config.core.strictAccess)}`,
    `Quarantined: **${quarantined}** · Backups: **${backups}** · Auto-backup: ${config.core.autoBackupHours ? `every ${config.core.autoBackupHours}h` : 'off'}`,
    missing.length ? `${em.error} **Missing permissions:** ${missing.join(', ')}` : `${em.success} I have every permission I need.`,
    `-# My highest role is #${me.roles.highest.position}. Keep it above every role I need to manage or punish.`
  ].filter(Boolean);
  await kit.send(interaction, lines);
}

async function setup(interaction) {
  const config = await store.loadConfig(interaction.guild.id);
  await runWizard(interaction, buildSecurityWizard(interaction.guild, config));
}

async function logs(interaction) {
  const module = interaction.options.getString('module');
  const user = interaction.options.getUser('user');
  const count = interaction.options.getInteger('count') || 10;
  const rows = await prisma.securityLog.findMany({
    where: {
      guildId: interaction.guild.id,
      ...(module ? { module } : {}),
      ...(user ? { OR: [{ executorId: user.id }, { targetId: user.id }] } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: count
  });
  if (!rows.length) {
    await kit.send(interaction, ['No security events match.']);
    return;
  }
  const icons = { info: `${em.shield}`, warning: `${em.error}`, critical: `${em.alert}` };
  const lines = rows.map(row => {
    const stamp = `<t:${Math.floor(row.createdAt.getTime() / 1000)}:R>`;
    const who = row.executorId ? ` by <@${row.executorId}>` : '';
    const target = row.targetId ? ` → <@${row.targetId}>` : '';
    return `${icons[row.severity] || icons.info} ${stamp} **${row.module}** ${row.action}${who}${target}`;
  });
  await kit.send(interaction, kit.clip(['**Recent security events**', ...lines]));
}

function targetOf(interaction) {
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');
  const picked = [user && { kind: 'user', id: user.id }, role && { kind: 'role', id: role.id }, channel && { kind: 'channel', id: channel.id }].filter(Boolean);
  return picked.length === 1 ? picked[0] : null;
}

async function whitelist(interaction, sub) {
  const guildId = interaction.guild.id;

  if (sub === 'list') {
    const entries = await store.listWhitelist(guildId);
    await kit.send(interaction, entries.length ? kit.clip([`**Whitelist** (${entries.length}/${MAX_WHITELIST_ENTRIES})`, ...entries.map(describeEntry)]) : ['The whitelist is empty. The owner and extra owners are always trusted.']);
    return;
  }

  if (sub === 'clear') {
    const entries = await store.listWhitelist(guildId);
    for (const entry of entries) await store.removeWhitelist(guildId, entry.targetId, entry.kind);
    await securityLog(interaction.guild, { module: 'core', action: 'whitelist cleared', severity: 'warning', executorId: interaction.user.id, lines: [`${entries.length} entries removed.`] });
    await kit.send(interaction, [`${em.success} Removed ${entries.length} whitelist entries.`]);
    return;
  }

  const target = targetOf(interaction);
  if (!target) {
    await kit.send(interaction, [`${em.error} Pick exactly one of user, role or channel.`]);
    return;
  }

  const existing = (await store.listWhitelist(guildId)).find(entry => entry.targetId === target.id && entry.kind === target.kind);
  const module = interaction.options.getString('module');

  if (sub === 'remove') {
    if (!existing) {
      await kit.send(interaction, [`${em.error} That target is not on the whitelist.`]);
      return;
    }
    if (module && !existing.modules.includes('all') && existing.modules.length > 1 && existing.modules.includes(module)) {
      const modules = existing.modules.filter(item => item !== module);
      await store.addWhitelist(guildId, { targetId: target.id, kind: target.kind, modules, events: existing.events, addedBy: interaction.user.id });
      await kit.send(interaction, [`${em.success} Removed **${module}** from that entry. Still whitelisted for: ${modules.join(', ')}.`]);
      return;
    }
    await store.removeWhitelist(guildId, target.id, target.kind);
    await securityLog(interaction.guild, { module: 'core', action: 'whitelist entry removed', executorId: interaction.user.id, targetId: target.kind === 'user' ? target.id : null, lines: [describeEntry(existing)] });
    await kit.send(interaction, [`${em.success} Removed from the whitelist.`]);
    return;
  }

  const scope = module || 'all';
  const events = parseEvents(interaction.options.getString('event'));
  let modules = existing ? [...new Set([...existing.modules, scope])] : [scope];
  if (modules.includes('all')) modules = ['all'];
  const touchesNuke = scope === 'all' || scope === 'antinuke';
  const hadAllNuke = Boolean(existing) && (existing.modules.includes('all') || existing.modules.includes('antinuke')) && existing.events.length === 0;
  let allowedEvents;
  if (modules.includes('all')) allowedEvents = [];
  else if (!modules.includes('antinuke')) allowedEvents = [];
  else if (hadAllNuke) allowedEvents = [];
  else allowedEvents = [...new Set([...(existing ? existing.events : []), ...(touchesNuke ? events : [])])];

  const result = await store.addWhitelist(guildId, { targetId: target.id, kind: target.kind, modules, events: allowedEvents, addedBy: interaction.user.id });
  if (!result.ok) {
    await kit.send(interaction, [`${em.error} The whitelist is full (${MAX_WHITELIST_ENTRIES} entries).`]);
    return;
  }
  await securityLog(interaction.guild, { module: 'core', action: 'whitelist entry added', severity: 'warning', executorId: interaction.user.id, targetId: target.kind === 'user' ? target.id : null, lines: [describeEntry(result.entry)] });
  await kit.send(interaction, [`${em.success} Whitelisted: ${describeEntry(result.entry)}`, target.kind === 'role' ? '-# Anyone holding this role is ignored by the selected modules.' : '-# Whitelisting weakens protection. Only add accounts you fully trust.']);
}

async function owners(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'list') {
    const rows = await store.listExtraOwners(guild.id);
    await kit.send(interaction, [`${em.crown} **Owner:** <@${guild.ownerId}>`, rows.length ? `**Extra owners** (${rows.length}/${MAX_EXTRA_OWNERS})\n${rows.map(row => `• <@${row.userId}>`).join('\n')}` : 'No extra owners yet.', '-# Extra owners are trusted by every module and can change security settings, but only the owner can add or remove them.']);
    return;
  }

  const user = interaction.options.getUser('user');
  if (sub === 'add') {
    if (user.bot) {
      await kit.send(interaction, [`${em.error} Bots cannot be extra owners.`]);
      return;
    }
    if (user.id === guild.ownerId) {
      await kit.send(interaction, [`${em.error} The server owner already has full access.`]);
      return;
    }
    const result = await store.addExtraOwner(guild.id, user.id, interaction.user.id);
    if (!result.ok) {
      await kit.send(interaction, [result.error === 'limit' ? `${em.error} You can have at most ${MAX_EXTRA_OWNERS} extra owners.` : `${em.error} They are already an extra owner.`]);
      return;
    }
    await securityLog(guild, { module: 'core', action: 'extra owner added', severity: 'critical', executorId: interaction.user.id, targetId: user.id });
    await kit.send(interaction, [`${em.success} <@${user.id}> is now an extra owner. They are trusted by every module and can change security settings.`]);
    return;
  }

  const result = await store.removeExtraOwner(guild.id, user.id);
  if (!result.ok) {
    await kit.send(interaction, [`${em.error} They are not an extra owner.`]);
    return;
  }
  await securityLog(guild, { module: 'core', action: 'extra owner removed', severity: 'warning', executorId: interaction.user.id, targetId: user.id });
  await kit.send(interaction, [`${em.success} <@${user.id}> is no longer an extra owner.`]);
}

async function resolveBackup(interaction) {
  const id = interaction.options.getString('backup');
  const rows = await prisma.securityBackup.findMany({ where: { guildId: interaction.guild.id } });
  return rows.find(row => row.id === id) || null;
}

async function backup(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'list') {
    const rows = await listBackups(guild.id);
    if (!rows.length) {
      await kit.send(interaction, ['No backups yet. Take one with `/security backup create`.']);
      return;
    }
    await kit.send(interaction, kit.clip(['**Backups**', ...rows.map(row => `• **${row.name}** ${row.auto ? '(auto) ' : ''}— <t:${Math.floor(row.createdAt.getTime() / 1000)}:R> · ${row.data.roles.length} roles · ${row.data.channels.length} channels`)]));
    return;
  }

  if (sub === 'create') {
    await interaction.deferReply({ ephemeral: true });
    const row = await createBackup(guild, { name: interaction.options.getString('name'), by: interaction.user.id });
    await securityLog(guild, { module: 'core', action: 'backup created', executorId: interaction.user.id, lines: [row.name] });
    await kit.send(interaction, [`${em.success} Saved **${row.name}** (${row.data.roles.length} roles, ${row.data.channels.length} channels).`]);
    return;
  }

  const row = await resolveBackup(interaction);
  if (!row) {
    await kit.send(interaction, [`${em.error} I could not find that backup.`]);
    return;
  }

  if (sub === 'delete') {
    await deleteBackup(guild.id, row.id);
    await kit.send(interaction, [`${em.success} Deleted **${row.name}**.`]);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const summary = await restoreBackup(guild, row, {
    roles: interaction.options.getBoolean('roles') !== false,
    channels: interaction.options.getBoolean('channels') !== false
  });
  await securityLog(guild, { module: 'core', action: 'backup restored', severity: 'warning', executorId: interaction.user.id, lines: [row.name, `Roles created: ${summary.rolesCreated} · channels created: ${summary.channelsCreated} · already present: ${summary.skipped} · failed: ${summary.failed}`] });
  await kit.send(interaction, [`${em.success} Restored from **${row.name}**.`, `Roles created: **${summary.rolesCreated}** · channels created: **${summary.channelsCreated}** · already present: **${summary.skipped}** · failed: **${summary.failed}**`]);
}

async function panic(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'end') {
    if (!isPanic(guild.id)) {
      const locks = await prisma.securityLock.count({ where: { guildId: guild.id } });
      if (!locks) {
        await kit.send(interaction, ['Panic mode is not active.']);
        return;
      }
    }
    await interaction.deferReply({ ephemeral: true });
    const count = await endPanic(guild, interaction.user.id);
    await kit.send(interaction, [`${em.success} Panic mode ended. Unlocked **${count}** channels.`]);
    return;
  }

  const config = (await store.loadConfig(guild.id)).antinuke;
  const minutes = interaction.options.getInteger('minutes') || config.panicMinutes;
  await interaction.deferReply({ ephemeral: true });
  const started = await startPanic(guild, `Started by ${interaction.user.tag}`, minutes);
  await kit.send(interaction, [started ? `${em.error} Panic mode started for **${minutes}** minutes. End it with \`/security panic end\`.` : `${em.error} Panic mode is already active.`]);
}

async function quarantine(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'setup') {
    await interaction.deferReply({ ephemeral: true });
    const role = await ensureQuarantineRole(guild);
    await kit.send(interaction, [`${em.success} Quarantine role ready: <@&${role.id}>. It is being denied access to every channel in the background.`, 'Create one channel that this role can see to explain what happened, then allow the role there.']);
    return;
  }

  if (sub === 'list') {
    const rows = await prisma.quarantineEntry.findMany({ where: { guildId: guild.id }, orderBy: { createdAt: 'desc' }, take: 25 });
    await kit.send(interaction, rows.length ? kit.clip(['**Quarantined members**', ...rows.map(row => `• <@${row.userId}> — ${row.reason || 'no reason'} · <t:${Math.floor(row.createdAt.getTime() / 1000)}:R>`)]) : ['Nobody is quarantined.']);
    return;
  }

  const user = interaction.options.getUser('user');
  if (sub === 'remove') {
    await interaction.deferReply({ ephemeral: true });
    const result = await releaseMember(guild, user.id, interaction.user.tag);
    await securityLog(guild, { module: 'core', action: 'member released from quarantine', executorId: interaction.user.id, targetId: user.id });
    await kit.send(interaction, [result.ok ? `${em.success} Released <@${user.id}>${result.restored ? ` and restored ${result.restored} roles` : ''}.` : `${em.error} They were not quarantined.`]);
    return;
  }

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await kit.send(interaction, [`${em.error} That user is not in the server.`]);
    return;
  }
  if (member.id === guild.ownerId || member.roles.highest.position >= myTop(guild) || member.id === interaction.user.id) {
    await kit.send(interaction, [`${em.error} ${SECURITY_ERRORS.hierarchy}`]);
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  await quarantineMember(guild, member, interaction.options.getString('reason') || `Quarantined by ${interaction.user.tag}`, interaction.user.id);
  await securityLog(guild, { module: 'core', action: 'member quarantined', severity: 'warning', executorId: interaction.user.id, targetId: user.id, detail: interaction.options.getString('reason') });
  await kit.send(interaction, [`${em.success} Quarantined <@${user.id}>. Release them with \`/security quarantine remove\`.`]);
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/security <status|setup|config|whitelist|owners|backup|panic|quarantine|logs>',
  async autocomplete(interaction) {
    if (!interaction.guild) return;
    const group = interaction.options.getSubcommandGroup(false);
    const focused = interaction.options.getFocused(true);

    if (group === 'config') {
      await kit.configAutocomplete(interaction, null);
      return;
    }
    if (focused.name === 'event') {
      await interaction.respond(kit.pick(NUKE_EVENTS, focused.value, event => ({ name: `${event.id} — ${event.label}`, value: event.id })));
      return;
    }
    if (focused.name === 'backup') {
      const rows = await listBackups(interaction.guild.id);
      await interaction.respond(kit.pick(rows, focused.value, row => ({ name: `${row.name}${row.auto ? ' (auto)' : ''}`, value: row.id })));
    }
  },
  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    let level = 'config';
    if (group === 'owners' && sub !== 'list') level = 'owner';
    else if (group === 'whitelist' && sub !== 'list') level = 'trusted';
    if (!(await requireAccess(interaction, level))) return;

    if (group === 'config') {
      await kit.runConfigSubcommand(interaction, sub, null);
      return;
    }
    if (group === 'whitelist') return whitelist(interaction, sub);
    if (group === 'owners') return owners(interaction, sub);
    if (group === 'backup') return backup(interaction, sub);
    if (group === 'panic') return panic(interaction, sub);
    if (group === 'quarantine') return quarantine(interaction, sub);

    if (sub === 'status') return status(interaction);
    if (sub === 'setup') return setup(interaction);
    if (sub === 'logs') return logs(interaction);
    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      await store.setRaw(interaction.guild.id, 'core', 'logChannelId', channel ? channel.id : '');
      await kit.send(interaction, [channel ? `${em.success} Security events will be posted in <#${channel.id}>.` : `${em.success} Security log channel cleared. Events are still stored for \`/security logs\`.`]);
    }
  }
};
