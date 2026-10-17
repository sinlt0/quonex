const PUNISHMENTS = ['none', 'strip', 'quarantine', 'timeout', 'kick', 'ban'];
const RAID_ACTIONS = ['none', 'verify', 'quarantine', 'timeout', 'kick', 'ban'];
const MODULES = ['core', 'antinuke', 'antiraid', 'automod', 'verification', 'lockdown'];
const WHITELIST_MODULES = ['all', 'antinuke', 'antiraid', 'automod', 'verification', 'lockdown'];
const MAX_EXTRA_OWNERS = 5;
const MAX_WHITELIST_ENTRIES = 100;

const DANGEROUS_DEFAULT = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'BanMembers',
  'KickMembers',
  'ModerateMembers',
  'MentionEveryone'
];

const NUKE_EVENTS = [
  { id: 'channelCreate', label: 'Channel creation', limit: 3, seconds: 10 },
  { id: 'channelDelete', label: 'Channel deletion', limit: 2, seconds: 10 },
  { id: 'channelUpdate', label: 'Channel edits', limit: 5, seconds: 10 },
  { id: 'roleCreate', label: 'Role creation', limit: 3, seconds: 10 },
  { id: 'roleDelete', label: 'Role deletion', limit: 2, seconds: 10 },
  { id: 'roleUpdate', label: 'Role edits', limit: 5, seconds: 10 },
  { id: 'dangerousRole', label: 'Dangerous permission added to a role', limit: 1, seconds: 30 },
  { id: 'dangerousGrant', label: 'Dangerous role given to a member', limit: 1, seconds: 30 },
  { id: 'memberBan', label: 'Member bans', limit: 3, seconds: 15 },
  { id: 'memberKick', label: 'Member kicks', limit: 3, seconds: 15 },
  { id: 'memberPrune', label: 'Member prune', limit: 1, seconds: 60 },
  { id: 'memberTimeout', label: 'Member timeouts', limit: 6, seconds: 20 },
  { id: 'webhookCreate', label: 'Webhook creation', limit: 2, seconds: 10 },
  { id: 'webhookDelete', label: 'Webhook deletion', limit: 2, seconds: 10 },
  { id: 'emojiDelete', label: 'Emoji deletion', limit: 4, seconds: 15 },
  { id: 'botAdd', label: 'Bot added', limit: 1, seconds: 60 },
  { id: 'vanityChange', label: 'Vanity URL change', limit: 1, seconds: 60 },
  { id: 'guildUpdate', label: 'Server settings change', limit: 3, seconds: 60 },
  { id: 'everyoneMention', label: '@everyone / @here mentions', limit: 3, seconds: 30 }
];

const FILTERS = [
  { id: 'spam', label: 'Message spam', heat: 60, thresholdKey: 'spam.count', threshold: 5, thresholdLabel: 'Messages in the window', extra: [['spam.seconds', 'int', 5, 1, 120, 'Window in seconds']] },
  { id: 'duplicate', label: 'Duplicate messages', heat: 50, thresholdKey: 'duplicate.count', threshold: 3, thresholdLabel: 'Identical messages', extra: [['duplicate.seconds', 'int', 30, 5, 300, 'Window in seconds']] },
  { id: 'mentions', label: 'Mass mentions', heat: 60, thresholdKey: 'mentions.max', threshold: 5, thresholdLabel: 'Mentions per message', extra: [] },
  { id: 'everyone', label: '@everyone / @here text', heat: 40, thresholdKey: null, extra: [] },
  { id: 'emojis', label: 'Emoji spam', heat: 40, thresholdKey: 'emojis.max', threshold: 10, thresholdLabel: 'Emojis per message', extra: [] },
  { id: 'caps', label: 'Excessive caps', heat: 30, thresholdKey: 'caps.percent', threshold: 70, thresholdLabel: 'Percent uppercase', extra: [['caps.minLength', 'int', 12, 4, 200, 'Minimum letters before caps are checked']] },
  { id: 'newlines', label: 'Walls of lines', heat: 40, thresholdKey: 'newlines.max', threshold: 10, thresholdLabel: 'Lines per message', extra: [] },
  { id: 'characters', label: 'Very long messages', heat: 40, thresholdKey: 'characters.max', threshold: 1200, thresholdLabel: 'Characters per message', extra: [] },
  { id: 'zalgo', label: 'Zalgo / glitch text', heat: 50, thresholdKey: null, extra: [] },
  { id: 'invites', label: 'Discord invites', heat: 100, thresholdKey: null, extra: [['invites.allowOwnServer', 'bool', true, null, null, 'Allow invites to this server']] },
  { id: 'links', label: 'Links', heat: 100, thresholdKey: null, extra: [['links.mode', 'enum', 'blocklist', ['blocklist', 'allowlist'], null, 'blocklist blocks the listed domains, allowlist blocks everything else'], ['links.list', 'list', [], null, null, 'Domains for the links filter']] },
  { id: 'words', label: 'Blocked words', heat: 100, thresholdKey: null, extra: [['words.list', 'list', [], null, null, 'Blocked words. Use * as a wildcard']] },
  { id: 'attachments', label: 'Attachments', heat: 30, thresholdKey: 'attachments.max', threshold: 5, thresholdLabel: 'Files per message', extra: [['attachments.blockedExtensions', 'list', ['exe', 'scr', 'bat', 'cmd', 'com', 'pif', 'msi', 'jar', 'vbs'], null, null, 'Blocked file extensions']] }
];

function buildRegistry() {
  const entries = [];
  const add = (module, key, type, def, label, extra = {}) => entries.push({ module, key, type, default: def, label, ...extra });

  add('core', 'logChannelId', 'channel', '', 'Channel where security events are logged');
  add('core', 'alertRoleIds', 'rolelist', [], 'Roles pinged on critical events');
  add('core', 'alertOwner', 'bool', true, 'DM the server owner on critical events');
  add('core', 'strictAccess', 'bool', true, 'Only the owner and extra owners can change settings (off lets Administrators change settings, but never owners or the whitelist)');
  add('core', 'quarantineRoleId', 'role', '', 'Role given to quarantined members');
  add('core', 'quarantineRemoveRoles', 'bool', true, 'Remove all other roles while quarantined');
  add('core', 'dmOffenders', 'bool', false, 'DM members before kicking or banning them');
  add('core', 'logRetentionDays', 'int', 30, 'Days to keep security logs', { min: 1, max: 365 });
  add('core', 'autoBackupHours', 'int', 0, 'Hours between automatic backups (0 turns it off)', { min: 0, max: 720 });
  add('core', 'maxBackups', 'int', 5, 'Backups to keep', { min: 1, max: 20 });

  add('antinuke', 'enabled', 'bool', false, 'Turn anti-nuke on');
  add('antinuke', 'punishment', 'enum', 'ban', 'Default punishment', { options: PUNISHMENTS.filter(item => item !== 'none') });
  add('antinuke', 'timeoutMinutes', 'int', 1440, 'Length of the timeout punishment in minutes', { min: 1, max: 40320 });
  add('antinuke', 'revert', 'bool', true, 'Undo deleted channels and roles, bans, webhooks and permission edits');
  add('antinuke', 'panicOnTrigger', 'bool', true, 'Start panic mode when anti-nuke punishes someone');
  add('antinuke', 'panicMinutes', 'int', 15, 'Panic mode length in minutes', { min: 1, max: 1440 });
  add('antinuke', 'botAddPolicy', 'enum', 'trusted', 'Who may add bots', { options: ['trusted', 'nobody', 'anyone'] });
  add('antinuke', 'dangerousPermissions', 'list', DANGEROUS_DEFAULT, 'Permissions treated as dangerous', { options: DANGEROUS_DEFAULT });
  add('antinuke', 'ignoreBotExecutors', 'bool', false, 'Skip checks for actions done by other bots');

  for (const event of NUKE_EVENTS) {
    add('antinuke', `${event.id}.enabled`, 'bool', true, `${event.label}: watch it`);
    add('antinuke', `${event.id}.limit`, 'int', event.limit, `${event.label}: allowed actions in the window`, { min: 1, max: 100 });
    add('antinuke', `${event.id}.seconds`, 'int', event.seconds, `${event.label}: window in seconds`, { min: 1, max: 3600 });
    add('antinuke', `${event.id}.punishment`, 'enum', 'default', `${event.label}: punishment`, { options: ['default', ...PUNISHMENTS] });
  }

  add('antiraid', 'enabled', 'bool', false, 'Turn anti-raid on');
  add('antiraid', 'joinThreshold', 'int', 10, 'Joins that count as a raid', { min: 2, max: 500 });
  add('antiraid', 'joinWindowSeconds', 'int', 10, 'Window for the join count in seconds', { min: 2, max: 600 });
  add('antiraid', 'raidAction', 'enum', 'kick', 'What happens to members who join during a raid', { options: RAID_ACTIONS });
  add('antiraid', 'raidMinutes', 'int', 10, 'How long raid mode lasts in minutes', { min: 1, max: 1440 });
  add('antiraid', 'punishRecentJoiners', 'bool', true, 'Also punish the members who triggered the raid');
  add('antiraid', 'pauseInvites', 'bool', true, 'Pause invites during a raid');
  add('antiraid', 'lockChannels', 'bool', false, 'Lock every channel during a raid');
  add('antiraid', 'timeoutMinutes', 'int', 60, 'Length of the timeout action in minutes', { min: 1, max: 40320 });
  add('antiraid', 'banDeleteMinutes', 'int', 0, 'Minutes of messages to delete when banning', { min: 0, max: 10080 });
  add('antiraid', 'minAccountAgeDays', 'int', 0, 'Join gate: minimum account age in days (0 turns it off)', { min: 0, max: 365 });
  add('antiraid', 'minAccountAgeAction', 'enum', 'kick', 'Join gate: action for young accounts', { options: RAID_ACTIONS });
  add('antiraid', 'noAvatar', 'bool', false, 'Join gate: act on accounts with no avatar');
  add('antiraid', 'noAvatarAction', 'enum', 'verify', 'Join gate: action for no avatar', { options: RAID_ACTIONS });
  add('antiraid', 'usernamePatterns', 'list', [], 'Join gate: regex patterns for blocked usernames', { keepCase: true });
  add('antiraid', 'usernamePatternAction', 'enum', 'kick', 'Join gate: action for matching usernames', { options: RAID_ACTIONS });
  add('antiraid', 'blockInviteUsernames', 'bool', true, 'Join gate: act on usernames that advertise an invite');
  add('antiraid', 'inviteUsernameAction', 'enum', 'ban', 'Join gate: action for invite usernames', { options: RAID_ACTIONS });
  add('antiraid', 'riskEnabled', 'bool', true, 'Score every join and act above the threshold');
  add('antiraid', 'riskThreshold', 'int', 100, 'Risk score that triggers the action', { min: 10, max: 500 });
  add('antiraid', 'riskAction', 'enum', 'verify', 'Action for risky joins', { options: RAID_ACTIONS });
  add('antiraid', 'riskNewAccount', 'int', 40, 'Score for accounts under 7 days old', { min: 0, max: 200 });
  add('antiraid', 'riskVeryNewAccount', 'int', 40, 'Extra score for accounts under 24 hours old', { min: 0, max: 200 });
  add('antiraid', 'riskNoAvatar', 'int', 20, 'Score for no avatar', { min: 0, max: 200 });
  add('antiraid', 'riskSimilarName', 'int', 30, 'Score for names similar to recent joiners', { min: 0, max: 200 });
  add('antiraid', 'riskJoinBurst', 'int', 30, 'Score when joins are arriving fast', { min: 0, max: 200 });
  add('antiraid', 'riskCreatedTogether', 'int', 40, 'Score for accounts created close to other recent joiners', { min: 0, max: 200 });
  add('antiraid', 'riskBadgeBonus', 'int', 30, 'Score removed for accounts with Discord badges', { min: 0, max: 200 });
  add('antiraid', 'ageBypassDays', 'int', 90, 'Accounts older than this skip risk scoring', { min: 0, max: 3650 });
  add('antiraid', 'burstJoins', 'int', 5, 'Joins in 30 seconds that count as a burst', { min: 2, max: 100 });
  add('antiraid', 'createdTogetherCount', 'int', 4, 'Accounts created within the window that count as a cluster', { min: 2, max: 50 });
  add('antiraid', 'createdTogetherMinutes', 'int', 30, 'Account creation window in minutes', { min: 1, max: 1440 });
  add('antiraid', 'similarNameCount', 'int', 4, 'Joiners with similar names that count as a pattern', { min: 2, max: 50 });

  add('automod', 'enabled', 'bool', false, 'Turn auto-moderation on');
  add('automod', 'deleteMessages', 'bool', true, 'Delete messages that break a filter');
  add('automod', 'notify', 'bool', true, 'Post a short notice when someone is punished');
  add('automod', 'ignoreBots', 'bool', true, 'Skip bot messages');
  add('automod', 'scanEdits', 'bool', true, 'Check edited messages too');
  add('automod', 'baseHeat', 'int', 8, 'Heat added by every message', { min: 0, max: 50 });
  add('automod', 'decaySeconds', 'int', 30, 'Seconds for 100 heat to cool down fully', { min: 5, max: 600 });
  add('automod', 'timeoutMinutes', 'int', 10, 'First timeout length in minutes', { min: 1, max: 40320 });
  add('automod', 'timeoutMultiplier', 'float', 2, 'Timeout grows by this much on repeat offences', { min: 1, max: 10 });
  add('automod', 'maxTimeoutMinutes', 'int', 10080, 'Longest timeout in minutes', { min: 1, max: 40320 });
  add('automod', 'strikeResetHours', 'int', 24, 'Hours without offences before strikes reset', { min: 1, max: 720 });
  add('automod', 'strikeThreshold', 'int', 5, 'Strikes before the strike action', { min: 1, max: 50 });
  add('automod', 'strikeAction', 'enum', 'kick', 'Action when the strike threshold is reached', { options: ['none', 'kick', 'ban'] });
  add('automod', 'purgeOnPunish', 'bool', true, 'Delete the offender\'s recent messages when punished');

  for (const filter of FILTERS) {
    add('automod', `${filter.id}.enabled`, 'bool', ['spam', 'duplicate', 'mentions', 'invites', 'everyone'].includes(filter.id), `${filter.label}: turn on`);
    add('automod', `${filter.id}.heat`, 'int', filter.heat, `${filter.label}: heat added per hit (100 punishes at once)`, { min: 0, max: 100 });
    if (filter.thresholdKey) {
      add('automod', filter.thresholdKey, 'int', filter.threshold, `${filter.label}: ${filter.thresholdLabel}`, { min: 1, max: 100000 });
    }
    for (const [key, type, def, minOrOptions, max, label] of filter.extra) {
      const meta = {};
      if (type === 'enum') meta.options = minOrOptions;
      else if (type === 'int') {
        meta.min = minOrOptions;
        meta.max = max;
      }
      add('automod', key, type, def, label, meta);
    }
  }

  add('verification', 'enabled', 'bool', false, 'Turn verification on');
  add('verification', 'mode', 'enum', 'captcha', 'How members verify', { options: ['button', 'captcha', 'passphrase', 'web'] });
  add('verification', 'scope', 'enum', 'all', 'Who must verify', { options: ['all', 'suspicious'] });
  add('verification', 'suspiciousAgeDays', 'int', 14, 'Accounts younger than this count as suspicious', { min: 0, max: 365 });
  add('verification', 'verifiedRoleId', 'role', '', 'Role given after verifying');
  add('verification', 'unverifiedRoleId', 'role', '', 'Role given on join and removed after verifying');
  add('verification', 'captchaLength', 'int', 5, 'Captcha length', { min: 4, max: 8 });
  add('verification', 'captchaDifficulty', 'enum', 'medium', 'Captcha difficulty', { options: ['easy', 'medium', 'hard'] });
  add('verification', 'passphrase', 'string', '', 'Phrase members must type in passphrase mode');
  add('verification', 'maxAttempts', 'int', 3, 'Wrong answers allowed', { min: 1, max: 10 });
  add('verification', 'timeLimitMinutes', 'int', 10, 'Minutes to verify before the fail action (0 means no limit)', { min: 0, max: 10080 });
  add('verification', 'failAction', 'enum', 'kick', 'Action when a member fails or runs out of time', { options: ['none', 'timeout', 'kick', 'ban'] });
  add('verification', 'failTimeoutMinutes', 'int', 60, 'Timeout length when failAction is timeout', { min: 1, max: 40320 });
  add('verification', 'dmOnJoin', 'bool', false, 'DM instructions when someone joins');
  add('verification', 'logSuccess', 'bool', true, 'Log successful verifications');
  const WEB_ACTIONS = ['allow', 'flag', 'quarantine', 'block'];
  add('verification', 'webVpnAction', 'enum', 'block', 'Web verification: action when a VPN, proxy or Tor connection is detected', { options: WEB_ACTIONS });
  add('verification', 'webHostingCounts', 'bool', true, 'Web verification: treat datacenter and hosting IPs like a VPN');
  add('verification', 'webAltAction', 'enum', 'flag', 'Web verification: action when the member shares an IP or device with another verified member', { options: WEB_ACTIONS });
  add('verification', 'webAltMatchIp', 'bool', true, 'Web verification: match alts by IP address');
  add('verification', 'webAltMatchFingerprint', 'bool', true, 'Web verification: match alts by device fingerprint');
  add('verification', 'webCountryAction', 'enum', 'block', 'Web verification: action for blocked or not allowed countries', { options: WEB_ACTIONS });
  add('verification', 'webBlockedCountries', 'list', [], 'Web verification: blocked country codes like ru or cn', { pattern: '^[a-z]{2}$' });
  add('verification', 'webAllowedCountries', 'list', [], 'Web verification: only allow these country codes (empty allows every country)', { pattern: '^[a-z]{2}$' });
  add('verification', 'webRetentionDays', 'int', 90, 'Web verification: days to remember hashed IPs and devices for alt matching', { min: 1, max: 3650 });
  add('verification', 'webLinkMinutes', 'int', 15, 'Web verification: minutes a verification link stays valid', { min: 2, max: 120 });
  add('verification', 'webMaxAttempts', 'int', 3, 'Web verification: tries per link', { min: 1, max: 10 });
  add('verification', 'panelChannelId', 'channel', '', 'Channel holding the verification panel');
  add('verification', 'panelMessageId', 'string', '', 'Internal: panel message ID');
  add('verification', 'panelTitle', 'string', 'Verify to enter', 'Panel title');
  add('verification', 'panelText', 'string', 'Press the button below to prove you are human and unlock the server.', 'Panel text');
  add('verification', 'panelButton', 'string', 'Verify', 'Panel button label');
  add('verification', 'panelColor', 'string', '#6f5de0', 'Panel accent color');

  add('lockdown', 'denyReactions', 'bool', true, 'Also stop reactions during a lockdown');
  add('lockdown', 'denyThreads', 'bool', true, 'Also stop thread creation during a lockdown');
  add('lockdown', 'denyVoice', 'bool', false, 'Also stop joining voice channels during a lockdown');
  add('lockdown', 'announce', 'bool', true, 'Post a notice in locked channels');
  add('lockdown', 'lockMessage', 'string', 'This channel is locked while staff handle a security issue.', 'Notice text');
  add('lockdown', 'unlockMessage', 'string', 'This channel has been unlocked.', 'Unlock notice text');
  add('lockdown', 'defaultMinutes', 'int', 0, 'Default lockdown length in minutes (0 means until ended)', { min: 0, max: 10080 });

  return entries;
}

const REGISTRY = buildRegistry();

const DEFAULTS = {};
for (const module of MODULES) DEFAULTS[module] = {};
for (const entry of REGISTRY) DEFAULTS[entry.module][entry.key] = entry.default;

function findEntry(module, key) {
  return REGISTRY.find(entry => entry.module === module && entry.key === key);
}

function keysFor(module) {
  return REGISTRY.filter(entry => entry.module === module);
}

const PRESETS = {
  low: {
    description: 'Light touch: spam and invite filtering, nuke limits are generous.',
    antinuke: { enabled: true, punishment: 'quarantine', panicOnTrigger: false, 'channelDelete.limit': 4, 'roleDelete.limit': 4, 'memberBan.limit': 6, 'memberKick.limit': 6 },
    antiraid: { enabled: true, joinThreshold: 15, joinWindowSeconds: 15, raidAction: 'timeout', riskEnabled: false },
    automod: { enabled: true, 'spam.enabled': true, 'invites.enabled': true, 'mentions.enabled': true, 'mentions.max': 8 }
  },
  balanced: {
    description: 'Recommended: full anti-nuke, raid detection with risk scoring, spam filters.',
    antinuke: { enabled: true, punishment: 'ban', panicOnTrigger: true },
    antiraid: { enabled: true, joinThreshold: 10, joinWindowSeconds: 10, raidAction: 'kick', riskEnabled: true, riskAction: 'verify', minAccountAgeDays: 1, minAccountAgeAction: 'verify' },
    automod: { enabled: true, 'spam.enabled': true, 'duplicate.enabled': true, 'mentions.enabled': true, 'invites.enabled': true, 'everyone.enabled': true, 'emojis.enabled': true, 'caps.enabled': true }
  },
  strict: {
    description: 'Tight limits, young accounts must verify, most filters on.',
    antinuke: { enabled: true, punishment: 'ban', panicOnTrigger: true, 'channelDelete.limit': 1, 'roleDelete.limit': 1, 'memberBan.limit': 2, 'memberKick.limit': 2, 'channelCreate.limit': 2, 'roleCreate.limit': 2 },
    antiraid: { enabled: true, joinThreshold: 6, joinWindowSeconds: 10, raidAction: 'ban', riskEnabled: true, riskThreshold: 80, riskAction: 'verify', minAccountAgeDays: 7, minAccountAgeAction: 'verify', noAvatar: true, pauseInvites: true },
    automod: {
      enabled: true,
      'spam.enabled': true,
      'duplicate.enabled': true,
      'mentions.enabled': true,
      'mentions.max': 4,
      'invites.enabled': true,
      'everyone.enabled': true,
      'emojis.enabled': true,
      'caps.enabled': true,
      'newlines.enabled': true,
      'zalgo.enabled': true,
      'attachments.enabled': true
    }
  },
  paranoid: {
    description: 'Maximum: every filter on, instant limits, locks channels during raids.',
    antinuke: { enabled: true, punishment: 'ban', panicOnTrigger: true, 'channelDelete.limit': 1, 'roleDelete.limit': 1, 'memberBan.limit': 1, 'memberKick.limit': 1, 'channelCreate.limit': 1, 'roleCreate.limit': 1, 'webhookCreate.limit': 1, botAddPolicy: 'nobody' },
    antiraid: { enabled: true, joinThreshold: 4, joinWindowSeconds: 10, raidAction: 'ban', riskEnabled: true, riskThreshold: 60, riskAction: 'verify', minAccountAgeDays: 14, minAccountAgeAction: 'verify', noAvatar: true, pauseInvites: true, lockChannels: true },
    automod: {
      enabled: true,
      'spam.enabled': true,
      'duplicate.enabled': true,
      'mentions.enabled': true,
      'mentions.max': 3,
      'invites.enabled': true,
      'everyone.enabled': true,
      'emojis.enabled': true,
      'caps.enabled': true,
      'newlines.enabled': true,
      'zalgo.enabled': true,
      'attachments.enabled': true,
      'characters.enabled': true,
      'links.enabled': true,
      'links.mode': 'allowlist'
    }
  }
};

const SECURITY_ERRORS = {
  'owner-only': 'Only the server owner can do that.',
  'no-access': 'Only the server owner or an extra owner can change security settings. Ask the owner to run `/security owners add`.',
  'unknown-key': 'That setting does not exist. Use `/security config view` to see every setting.',
  'invalid-value': 'That value is not valid for this setting.',
  'not-list': 'That setting is not a list.',
  'hierarchy': 'I cannot act on that member because their top role is above mine, or they are the owner.',
  'guild-only': 'This only works in a server.'
};

module.exports = {
  PUNISHMENTS,
  RAID_ACTIONS,
  MODULES,
  WHITELIST_MODULES,
  MAX_EXTRA_OWNERS,
  MAX_WHITELIST_ENTRIES,
  DANGEROUS_DEFAULT,
  NUKE_EVENTS,
  FILTERS,
  REGISTRY,
  DEFAULTS,
  PRESETS,
  SECURITY_ERRORS,
  findEntry,
  keysFor
};
