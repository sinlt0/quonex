const { PRESETS, REGISTRY, findEntry } = require('../../../config/security');
const { runFullSetup } = require('../fullSetup');
const { buildVerificationWizard } = require('./verification');
const { em } = require('../../emojis');

const FILTERS = REGISTRY.filter(entry => entry.module === 'automod' && entry.key.endsWith('.enabled') && entry.key !== 'enabled').map(entry => ({
  key: entry.key,
  name: entry.key.replace('.enabled', ''),
  label: entry.label.split(':')[0]
}));

const ESCALATION = {
  off: { label: 'No automatic escalation', timeout: 0, kick: 0, ban: 0 },
  timeout: { label: 'Timeout at 3 warnings', timeout: 3, kick: 0, ban: 0 },
  kick: { label: 'Timeout at 3, kick at 5', timeout: 3, kick: 5, ban: 0 },
  ban: { label: 'Timeout at 3, ban at 5', timeout: 3, kick: 0, ban: 5 }
};

function presetValue(name, module, key) {
  const preset = PRESETS[name][module];
  if (preset && preset[key] !== undefined) return preset[key];
  return findEntry(module, key).default;
}

function derive(a) {
  a.nukePunishment = presetValue(a.preset, 'antinuke', 'punishment');
  a.nukePanic = presetValue(a.preset, 'antinuke', 'panicOnTrigger');
  a.nukeBots = presetValue(a.preset, 'antinuke', 'botAddPolicy');
  a.raidAction = presetValue(a.preset, 'antiraid', 'raidAction');
  a.raidAgeDays = String(presetValue(a.preset, 'antiraid', 'minAccountAgeDays'));
  a.raidAgeAction = presetValue(a.preset, 'antiraid', 'minAccountAgeAction');
  a.raidPause = presetValue(a.preset, 'antiraid', 'pauseInvites');
  a.filters = FILTERS.filter(filter => presetValue(a.preset, 'automod', filter.key) === true).map(filter => filter.name);
}

function enumOptions(module, key, labels) {
  return findEntry(module, key).options.map(value => ({ label: labels[value] || value, value }));
}

const PUNISH = { strip: 'Strip dangerous permissions', quarantine: 'Quarantine', timeout: 'Timeout', kick: 'Kick', ban: 'Ban' };
const RAID = { none: 'Nothing', verify: 'Make them verify', quarantine: 'Quarantine', timeout: 'Timeout', kick: 'Kick', ban: 'Ban' };
const BOTS = { trusted: 'Only trusted members', nobody: 'Nobody', anyone: 'Anyone with the permission' };

const AGE_OPTIONS = [0, 1, 3, 7, 14, 30].map(value => ({ label: value === 0 ? 'No minimum age' : `${value} day${value === 1 ? '' : 's'}`, value: String(value) }));

function build(guild, current) {
  const verification = buildVerificationWizard(guild, current.verification);
  const verifySteps = verification.steps
    .filter(step => !step.review)
    .map(step => ({ ...step, title: `Verification: ${step.title}`, show: a => a.verifyOn && (step.show ? step.show(a) : true) }));
  return {
    title: `${em.shield} Security setup`,
    color: 0x6f5de0,
    applyLabel: 'Apply setup',
    async initial() {
      const a = {
        preset: 'balanced',
        appeals: true,
        reports: true,
        weekly: true,
        warnEscalation: 'timeout',
        createChannels: true,
        staffRole: '',
        messageLogs: true,
        logChannel: current.core.logChannelId && guild.channels.cache.get(current.core.logChannelId) ? current.core.logChannelId : '',
        quarantine: true,
        backup: true,
        autoBackup: '24',
        verifyOn: false
      };
      derive(a);
      return { ...a, ...(await verification.initial()) };
    },
    onChange(key, a) {
      if (key === 'preset') derive(a);
    },
    steps: [
      {
        id: 'preset',
        title: 'How strict?',
        text: 'This sets sensible starting values for everything. You can change each part in the next steps.',
        fields: [
          {
            key: 'preset',
            type: 'select',
            label: 'Protection level',
            options: Object.entries(PRESETS).map(([value, preset]) => ({ label: value[0].toUpperCase() + value.slice(1), value, description: preset.description }))
          }
        ]
      },
      {
        id: 'antinuke',
        title: 'Anti-nuke',
        text: 'Stops compromised or rogue admins who mass delete channels and roles, or mass ban members.',
        fields: [
          { key: 'nukePunishment', type: 'select', label: 'Punishment for nukers', options: Object.keys(PUNISH).map(value => ({ label: PUNISH[value], value })) },
          { key: 'nukePanic', type: 'bool', label: 'Panic mode on trigger', description: 'Lock down risky actions server wide for a while when someone is caught.' },
          { key: 'nukeBots', type: 'select', label: 'Who may add bots', options: enumOptions('antinuke', 'botAddPolicy', BOTS) }
        ]
      },
      {
        id: 'antiraid',
        title: 'Anti-raid',
        text: 'Detects floods of new accounts and young or suspicious joins.',
        fields: [
          { key: 'raidAction', type: 'select', label: 'Members who join during a raid', options: enumOptions('antiraid', 'raidAction', RAID) },
          { key: 'raidAgeDays', type: 'select', label: 'Minimum account age', options: AGE_OPTIONS },
          { key: 'raidAgeAction', type: 'select', label: 'Younger accounts', show: a => a.raidAgeDays !== '0', options: enumOptions('antiraid', 'minAccountAgeAction', RAID) },
          { key: 'raidPause', type: 'bool', label: 'Pause invites during a raid' }
        ]
      },
      {
        id: 'automod',
        title: 'Auto-mod',
        text: 'Pick the filters to turn on. Leave everything unselected to keep auto-mod off.',
        fields: [{ key: 'filters', type: 'select', multi: true, label: 'Filters', placeholder: 'Choose filters', options: FILTERS.map(filter => ({ label: filter.label, value: filter.name })) }]
      },
      {
        id: 'moderation',
        title: 'Moderation',
        text: 'Commands like /ban and /warn are always available. These settings add the extras.',
        fields: [
          { key: 'appeals', type: 'bool', label: 'Ban appeals', description: 'Banned members get an Appeal button in their ban DM.' },
          { key: 'reports', type: 'bool', label: 'Message reports', description: 'Members can report messages from the right-click menu.' },
          { key: 'weekly', type: 'bool', label: 'Weekly moderator report' },
          { key: 'warnEscalation', type: 'select', label: 'Warning escalation', options: Object.entries(ESCALATION).map(([value, item]) => ({ label: item.label, value })) }
        ]
      },
      {
        id: 'logs',
        title: 'Logs and channels',
        text: 'Private channels keep security events, cases, message logs and appeals out of public view.',
        fields: [
          { key: 'createChannels', type: 'bool', label: 'Create private log channels for me', description: 'Existing log channels you already set are kept.' },
          { key: 'staffRole', type: 'role', label: 'Staff role that can read them', placeholder: 'Optional. Administrators always can.', show: a => a.createChannels },
          { key: 'messageLogs', type: 'bool', label: 'Log edited and deleted messages', description: 'Also catches ghost pings.' },
          { key: 'logChannel', type: 'channel', label: 'Use an existing channel for security logs', placeholder: 'Optional' }
        ]
      },
      {
        id: 'extras',
        title: 'Safety net',
        text: 'Quarantine isolates a suspect member. Backups let you restore roles and channels after a nuke.',
        fields: [
          { key: 'quarantine', type: 'bool', label: 'Create the quarantine role' },
          { key: 'backup', type: 'bool', label: 'Save a baseline backup now' },
          {
            key: 'autoBackup',
            type: 'select',
            label: 'Automatic backups',
            options: [{ label: 'Off', value: '0' }, { label: 'Every 24 hours', value: '24' }, { label: 'Every 3 days', value: '72' }, { label: 'Every week', value: '168' }]
          },
          { key: 'verifyOn', type: 'bool', label: 'Also set up member verification', description: 'Adds the verification questions after this step. Or run /verification setup on its own later.' }
        ]
      },
      ...verifySteps,
      { id: 'review', title: 'Review', review: true, text: 'Check your choices. Nothing is deleted, and you can change any value later.' }
    ],
    summary(a) {
      const filters = a.filters.length ? a.filters.join(', ') : 'off';
      return [
        `**Level:** ${a.preset}`,
        `**Anti-nuke:** ${a.nukePunishment}${a.nukePanic ? ' + panic mode' : ''} · bots: ${a.nukeBots}`,
        `**Anti-raid:** raids ${a.raidAction} · accounts under ${a.raidAgeDays === '0' ? 'no limit' : `${a.raidAgeDays} days`}${a.raidAgeDays !== '0' ? ` ${a.raidAgeAction}` : ''}${a.raidPause ? ' · pause invites' : ''}`,
        `**Auto-mod:** ${filters}`,
        `**Moderation:** appeals ${a.appeals ? 'on' : 'off'} · reports ${a.reports ? 'on' : 'off'} · weekly report ${a.weekly ? 'on' : 'off'} · ${ESCALATION[a.warnEscalation].label.toLowerCase()}`,
        `**Channels:** ${a.createChannels ? 'private log channels created' : 'no new channels'}${a.messageLogs ? ' · message logs on' : ''}${a.logChannel ? ` · security log <#${a.logChannel}>` : ''}`,
        `**Safety net:** ${a.quarantine ? 'quarantine role' : 'no quarantine role'} · ${a.backup ? 'baseline backup' : 'no backup'} · auto backups ${a.autoBackup === '0' ? 'off' : `every ${a.autoBackup}h`}`,
        ...(a.verifyOn ? ['**Verification**', ...verification.summary(a)] : [])
      ].filter(Boolean);
    },
    async apply(a, { guild: target, user }) {
      const preset = PRESETS[a.preset];
      const automod = {};
      for (const [key, value] of Object.entries(preset.automod)) if (!key.endsWith('.enabled') && key !== 'enabled') automod[key] = value;
      for (const filter of FILTERS) automod[filter.key] = a.filters.includes(filter.name);
      automod.enabled = a.filters.length > 0;

      const custom = {
        antinuke: { ...preset.antinuke, enabled: true, punishment: a.nukePunishment, panicOnTrigger: a.nukePanic, botAddPolicy: a.nukeBots },
        antiraid: { ...preset.antiraid, enabled: true, raidAction: a.raidAction, minAccountAgeDays: Number(a.raidAgeDays), minAccountAgeAction: a.raidAgeAction, pauseInvites: a.raidPause },
        automod
      };
      const escalation = ESCALATION[a.warnEscalation];
      const wantedChannels = ['security', 'mod'];
      if (a.messageLogs) wantedChannels.push('messages');
      if (a.appeals || a.reports) wantedChannels.push('queue');

      const result = await runFullSetup({
        guild: target,
        user,
        custom,
        presetName: a.preset,
        staffRole: a.staffRole ? target.roles.cache.get(a.staffRole) : null,
        createLogChannels: a.createChannels,
        wantedChannels,
        quarantine: a.quarantine,
        backup: a.backup,
        logChannel: a.logChannel || null,
        autoBackupHours: Number(a.autoBackup),
        moderation: {
          appealsEnabled: a.appeals,
          reportsEnabled: a.reports,
          weeklyReport: a.weekly,
          countTowardAntiNuke: true,
          protectTrusted: true,
          warnTimeoutAt: escalation.timeout,
          warnKickAt: escalation.kick,
          warnBanAt: escalation.ban,
          ...(a.messageLogs ? {} : { msgLogChannelId: '' })
        }
      });

      const lines = [`### ${em.success} Security setup finished`, ...result.steps.map(step => `${step.ok ? em.on : em.off} ${step.text}`)];
      if (a.verifyOn) {
        const extra = await verification.apply(a, { guild: target, user });
        lines.push(...extra.lines.filter(line => !line.startsWith('### ')));
      }
      lines.push('**Still up to you**', ...result.manual.map(text => `• ${text}`));
      while (lines.join('\n').length > 3800) lines.splice(lines.length - 3, 1);
      return { lines };
    }
  };
}

module.exports = { buildSecurityWizard: build };
