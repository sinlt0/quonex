const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const store = require('../store');
const { postPanel } = require('../verification');
const { securityLog } = require('../alerts');
const { findEntry } = require('../../../config/security');
const { CREATE } = require('../wizard');
const { em } = require('../../emojis');

const MODES = [
  { label: 'Button', value: 'button', description: 'One click. Stops the laziest bots.' },
  { label: 'Captcha', value: 'captcha', description: 'Type the code from an image.' },
  { label: 'Passphrase', value: 'passphrase', description: 'Type a phrase from your rules.' },
  { label: 'Web (VPN and alt detection)', value: 'web', description: 'Confirm on the dashboard. Detects VPNs and alt accounts.' }
];

function numberOptions(values, unit, zeroLabel) {
  return values.map(value => ({ label: value === 0 && zeroLabel ? zeroLabel : `${value} ${unit}${value === 1 ? '' : 's'}`, value: String(value) }));
}

function enumOptions(key, labels) {
  return findEntry('verification', key).options.map(value => ({ label: labels[value] || value, value }));
}

const WEB_LABELS = { allow: 'Allow', flag: 'Allow and flag for staff', quarantine: 'Quarantine', block: 'Block' };

async function denyRoleEverywhere(guild, role, exceptIds) {
  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread() || exceptIds.includes(channel.id)) continue;
    await channel.permissionOverwrites.edit(role, { ViewChannel: false }, { reason: 'Quonex verification: hide the server from unverified members' }).catch(() => {});
  }
}

function build(guild, current) {
  return {
    title: `${em.verify} Verification setup`,
    color: 0x6f5de0,
    applyLabel: 'Turn on verification',
    async initial() {
      return {
        mode: current.mode,
        scope: current.scope,
        captchaDifficulty: current.captchaDifficulty,
        passphrase: current.passphrase,
        roleMode: current.unverifiedRoleId || current.verifiedRoleId ? 'existing' : 'create',
        createVerified: false,
        verifiedRoleId: current.verifiedRoleId,
        unverifiedRoleId: current.unverifiedRoleId,
        panelChannel: current.panelChannelId && guild.channels.cache.get(current.panelChannelId) ? current.panelChannelId : CREATE,
        panelTitle: current.panelTitle,
        panelButton: current.panelButton,
        maxAttempts: String(current.maxAttempts),
        timeLimitMinutes: String(current.timeLimitMinutes),
        failAction: current.failAction,
        dmOnJoin: current.dmOnJoin,
        suspiciousAgeDays: String(current.suspiciousAgeDays),
        webVpnAction: current.webVpnAction,
        webAltAction: current.webAltAction,
        webHostingCounts: current.webHostingCounts,
        webRetentionDays: String(current.webRetentionDays)
      };
    },
    steps: [
      {
        id: 'method',
        title: 'How members verify',
        text: 'Pick how new members prove they are real, and who has to do it.',
        fields: [
          { key: 'mode', type: 'select', label: 'Method', options: MODES },
          { key: 'scope', type: 'select', label: 'Who must verify', options: [{ label: 'Everyone who joins', value: 'all' }, { label: 'Suspicious accounts only', value: 'suspicious', description: 'New accounts, no avatar and similar signals.' }] },
          { key: 'captchaDifficulty', type: 'select', label: 'Captcha difficulty', show: a => a.mode === 'captcha', options: [{ label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' }] },
          { key: 'passphrase', type: 'text', label: 'Passphrase', description: 'The phrase members must type, for example a word from your rules.', modalLabel: 'Phrase members must type', show: a => a.mode === 'passphrase' }
        ],
        validate: a => (a.mode === 'passphrase' && !a.passphrase ? 'Set the passphrase members have to type.' : null)
      },
      {
        id: 'roles',
        title: 'Roles',
        text: 'Verification works by swapping roles. Members with the Unverified role cannot see your channels until they verify.',
        fields: [
          {
            key: 'roleMode',
            type: 'select',
            label: 'Roles to use',
            options: [
              { label: 'Create an Unverified role for me (recommended)', value: 'create', description: 'Hidden from every channel except the verify channel.' },
              { label: 'Use roles I already have', value: 'existing', description: 'You control the channel permissions yourself.' }
            ]
          },
          { key: 'createVerified', type: 'bool', label: 'Also create a Verified role', description: 'Given after verifying, for channels that should only show to verified members.', show: a => a.roleMode === 'create' },
          { key: 'unverifiedRoleId', type: 'role', label: 'Unverified role', description: 'Given on join, removed after verifying.', show: a => a.roleMode === 'existing' },
          { key: 'verifiedRoleId', type: 'role', label: 'Verified role', description: 'Given after verifying.', show: a => a.roleMode === 'existing' }
        ],
        validate: a => (a.roleMode === 'existing' && !a.unverifiedRoleId && !a.verifiedRoleId ? 'Choose at least one role.' : null)
      },
      {
        id: 'panel',
        title: 'Verify panel',
        text: 'The message members press to start verification.',
        fields: [
          { key: 'panelChannel', type: 'channel', label: 'Panel channel', create: '#verify', types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
          { key: 'panelTitle', type: 'text', label: 'Panel title', max: 100 },
          { key: 'panelButton', type: 'text', label: 'Button label', max: 40 }
        ],
        validate: a => (!a.panelChannel ? 'Choose a channel or let me create one.' : null)
      },
      {
        id: 'rules',
        title: 'Rules',
        text: 'What happens when someone fails or takes too long.',
        fields: [
          { key: 'maxAttempts', type: 'select', label: 'Wrong answers allowed', options: numberOptions([1, 3, 5, 10], 'attempt') },
          { key: 'timeLimitMinutes', type: 'select', label: 'Time to verify', options: [{ label: 'No limit', value: '0' }, { label: '10 minutes', value: '10' }, { label: '30 minutes', value: '30' }, { label: '1 hour', value: '60' }, { label: '1 day', value: '1440' }] },
          { key: 'failAction', type: 'select', label: 'If they fail or run out of time', options: [{ label: 'Nothing', value: 'none' }, { label: 'Timeout', value: 'timeout' }, { label: 'Kick', value: 'kick' }, { label: 'Ban', value: 'ban' }] },
          { key: 'dmOnJoin', type: 'bool', label: 'DM instructions when someone joins' }
        ]
      },
      {
        id: 'suspicious',
        title: 'Suspicious accounts',
        show: a => a.scope === 'suspicious',
        text: 'Accounts younger than this must verify.',
        fields: [{ key: 'suspiciousAgeDays', type: 'select', label: 'Account age that counts as suspicious', options: numberOptions([1, 3, 7, 14, 30, 90], 'day') }]
      },
      {
        id: 'web',
        title: 'Web verification checks',
        show: a => a.mode === 'web',
        text: 'Members confirm on the dashboard, where connections and devices are checked. IPs and devices are stored as hashes only.',
        fields: [
          { key: 'webVpnAction', type: 'select', label: 'VPN, proxy or Tor detected', options: enumOptions('webVpnAction', WEB_LABELS) },
          { key: 'webAltAction', type: 'select', label: 'Shares an IP or device with another verified member', options: enumOptions('webAltAction', WEB_LABELS) },
          { key: 'webHostingCounts', type: 'bool', label: 'Treat datacenter and hosting IPs like a VPN' },
          { key: 'webRetentionDays', type: 'select', label: 'Remember hashes for alt matching', options: numberOptions([7, 30, 90, 365], 'day') }
        ]
      },
      { id: 'review', title: 'Review', review: true, text: 'Check your choices. Nothing changes until you confirm.' }
    ],
    summary(a) {
      const lines = [`**Method:** ${MODES.find(m => m.value === a.mode).label} · ${a.scope === 'all' ? 'everyone must verify' : `accounts younger than ${a.suspiciousAgeDays} days`}`];
      if (a.roleMode === 'create') lines.push(`**Roles:** a new Unverified role${a.createVerified ? ' and a new Verified role' : ''}`);
      else lines.push(`**Roles:** ${a.unverifiedRoleId ? `unverified <@&${a.unverifiedRoleId}>` : ''} ${a.verifiedRoleId ? `verified <@&${a.verifiedRoleId}>` : ''}`.trim());
      lines.push(`**Panel:** ${a.panelChannel === CREATE ? 'a new #verify channel' : `<#${a.panelChannel}>`}`);
      lines.push(`**Rules:** ${a.maxAttempts} attempts · ${a.timeLimitMinutes === '0' ? 'no time limit' : `${a.timeLimitMinutes} min limit`} · on failure ${a.failAction}`);
      if (a.mode === 'web') lines.push(`**Web checks:** VPN ${a.webVpnAction} · alts ${a.webAltAction}`);
      return lines;
    },
    async apply(a, { guild: target, user }) {
      const lines = [`### ${em.success} Verification is on`];
      let verifiedId = '';
      let unverifiedId = '';
      let channel = a.panelChannel && a.panelChannel !== CREATE ? target.channels.cache.get(a.panelChannel) : null;

      if (a.panelChannel === CREATE) {
        channel = await target.channels
          .create({
            name: 'verify',
            type: ChannelType.GuildText,
            topic: 'Press the button to verify and unlock the server.',
            permissionOverwrites: [{ id: target.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] }],
            reason: 'Quonex verification setup'
          })
          .catch(() => null);
        lines.push(channel ? `${em.on} Created <#${channel.id}>` : `${em.off} I could not create the verify channel`);
      }
      if (!channel) return { lines: [`${em.off} I need a channel to post the panel. Run the setup again and pick one.`] };

      if (a.roleMode === 'create') {
        const unverified = await target.roles.create({ name: 'Unverified', color: 0x6b7280, permissions: [], reason: 'Quonex verification setup' }).catch(() => null);
        if (unverified) {
          unverifiedId = unverified.id;
          await channel.permissionOverwrites.edit(unverified, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false }).catch(() => {});
          denyRoleEverywhere(target, unverified, [channel.id]);
          lines.push(`${em.on} Created <@&${unverified.id}> and hiding every other channel from it in the background`);
        } else {
          lines.push(`${em.off} I could not create the Unverified role (needs Manage Roles)`);
        }
        if (a.createVerified) {
          const verified = await target.roles.create({ name: 'Verified', color: 0x22c55e, permissions: [], reason: 'Quonex verification setup' }).catch(() => null);
          if (verified) {
            verifiedId = verified.id;
            lines.push(`${em.on} Created <@&${verified.id}>`);
          }
        }
      } else {
        unverifiedId = a.unverifiedRoleId || '';
        verifiedId = a.verifiedRoleId || '';
        if (unverifiedId) await channel.permissionOverwrites.edit(unverifiedId, { ViewChannel: true, ReadMessageHistory: true }).catch(() => {});
      }

      if (!unverifiedId && !verifiedId) return { lines: [`${em.off} No role could be set up, so verification was not turned on.`] };

      const values = {
        mode: a.mode,
        scope: a.scope,
        captchaDifficulty: a.captchaDifficulty,
        passphrase: a.mode === 'passphrase' ? a.passphrase : '',
        verifiedRoleId: verifiedId,
        unverifiedRoleId: unverifiedId,
        panelTitle: a.panelTitle || 'Verify to enter',
        panelButton: a.panelButton || 'Verify',
        maxAttempts: Number(a.maxAttempts),
        timeLimitMinutes: Number(a.timeLimitMinutes),
        failAction: a.failAction,
        dmOnJoin: a.dmOnJoin,
        suspiciousAgeDays: Number(a.suspiciousAgeDays),
        webVpnAction: a.webVpnAction,
        webAltAction: a.webAltAction,
        webHostingCounts: a.webHostingCounts,
        webRetentionDays: Number(a.webRetentionDays),
        enabled: true
      };
      for (const [key, value] of Object.entries(values)) await store.setRaw(target.id, 'verification', key, value);

      const sent = await postPanel(target, channel).catch(() => null);
      lines.push(sent ? `${em.on} Panel posted in <#${channel.id}>` : `${em.off} Settings saved, but I could not post in <#${channel.id}>. Check my permissions there`);
      await securityLog(target, { module: 'verification', action: 'verification set up with the wizard', executorId: user.id });

      if (a.mode === 'web') lines.push('-# Web verification needs the dashboard running with the verification variables from `.env.example`.');
      if (a.roleMode === 'existing') lines.push('-# Hide your channels from the unverified role (or from @everyone) and show them to the verified role.');
      lines.push('-# Fine-tune anything with `/verification view` and `/verification set`.');
      return { lines };
    }
  };
}

module.exports = { buildVerificationWizard: build };
