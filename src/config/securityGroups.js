const { REGISTRY, NUKE_EVENTS, FILTERS } = require('./security');

const HIDDEN_KEYS = new Set(['verification.panelMessageId']);

const SECTIONS = {
  core: [
    { id: 'logging', title: 'Logging and alerts', description: 'Where events are posted and who gets told about critical ones.', keys: ['logChannelId', 'alertRoleIds', 'alertOwner', 'logRetentionDays'] },
    { id: 'access', title: 'Access', description: 'Who can change security settings.', keys: ['strictAccess'] },
    { id: 'quarantine', title: 'Quarantine and punishments', description: 'Used by every module that can quarantine or remove members.', keys: ['quarantineRoleId', 'quarantineRemoveRoles', 'dmOffenders'] },
    { id: 'backups', title: 'Backups', description: 'Automatic snapshots of roles and channels.', keys: ['autoBackupHours', 'maxBackups'] }
  ],
  antinuke: [
    { id: 'response', title: 'Response', description: 'What happens when someone goes over a limit.', keys: ['punishment', 'timeoutMinutes', 'revert', 'panicOnTrigger', 'panicMinutes', 'ignoreBotExecutors'] },
    { id: 'bots', title: 'Bots and permissions', description: 'Who may add bots and which permissions count as dangerous.', keys: ['botAddPolicy', 'dangerousPermissions'] }
  ],
  antiraid: [
    { id: 'detection', title: 'Raid detection', description: 'How many joins start raid mode, and what raid mode does.', keys: ['joinThreshold', 'joinWindowSeconds', 'raidAction', 'raidMinutes', 'punishRecentJoiners', 'pauseInvites', 'lockChannels', 'timeoutMinutes', 'banDeleteMinutes'] },
    { id: 'gate', title: 'Join gate', description: 'Rules checked on every single join, raid or not.', keys: ['minAccountAgeDays', 'minAccountAgeAction', 'noAvatar', 'noAvatarAction', 'blockInviteUsernames', 'inviteUsernameAction', 'usernamePatterns', 'usernamePatternAction'] },
    { id: 'risk', title: 'Risk scoring', description: 'Each join gets a score. Above the threshold the action applies.', keys: ['riskEnabled', 'riskThreshold', 'riskAction', 'ageBypassDays', 'riskNewAccount', 'riskVeryNewAccount', 'riskNoAvatar', 'riskSimilarName', 'riskJoinBurst', 'riskCreatedTogether', 'riskBadgeBonus'] },
    { id: 'patterns', title: 'Pattern tuning', description: 'Thresholds for the burst, cluster and similar name signals.', keys: ['burstJoins', 'createdTogetherCount', 'createdTogetherMinutes', 'similarNameCount'] }
  ],
  automod: [
    { id: 'behavior', title: 'Behavior', description: 'What auto-mod does with a message that breaks a filter.', keys: ['deleteMessages', 'notify', 'ignoreBots', 'scanEdits', 'purgeOnPunish'] },
    { id: 'heat', title: 'Heat system', description: 'Every message adds heat and filters add more. At 100 the member is punished.', keys: ['baseHeat', 'decaySeconds'] },
    { id: 'punishments', title: 'Timeouts and strikes', description: 'Escalation when someone keeps offending.', keys: ['timeoutMinutes', 'timeoutMultiplier', 'maxTimeoutMinutes', 'strikeThreshold', 'strikeAction', 'strikeResetHours'] }
  ],
  verification: [
    { id: 'method', title: 'Method', description: 'How members prove they are real.', keys: ['mode', 'scope', 'suspiciousAgeDays', 'passphrase', 'captchaLength', 'captchaDifficulty'] },
    { id: 'roles', title: 'Roles', description: 'Roles swapped when a member verifies.', keys: ['verifiedRoleId', 'unverifiedRoleId'] },
    { id: 'rules', title: 'Rules', description: 'Attempts, time limit and what happens on failure.', keys: ['maxAttempts', 'timeLimitMinutes', 'failAction', 'failTimeoutMinutes', 'dmOnJoin', 'logSuccess'] },
    { id: 'web', title: 'Web verification', description: 'Used when the method is web. Members confirm on the dashboard, where VPNs and alt accounts are checked.', keys: ['webVpnAction', 'webHostingCounts', 'webAltAction', 'webAltMatchIp', 'webAltMatchFingerprint', 'webCountryAction', 'webBlockedCountries', 'webAllowedCountries', 'webRetentionDays', 'webLinkMinutes', 'webMaxAttempts'] },
    { id: 'panel', title: 'Panel', description: 'The message members click to verify.', keys: ['panelChannelId', 'panelTitle', 'panelText', 'panelButton', 'panelColor'] }
  ],
  lockdown: [
    { id: 'lockdown', title: 'Lockdown behavior', description: 'What a lockdown denies and announces.', keys: ['denyReactions', 'denyThreads', 'denyVoice', 'announce', 'lockMessage', 'unlockMessage', 'defaultMinutes'] }
  ]
};

const SECTIONED_MODULES = Object.keys(SECTIONS);

function plain(entry) {
  const out = { key: entry.key, type: entry.type, label: entry.label };
  if (entry.options) out.options = entry.options;
  if (entry.min !== undefined) out.min = entry.min;
  if (entry.max !== undefined) out.max = entry.max;
  if (entry.type === 'float') out.step = 0.1;
  if (entry.keepCase) out.keepCase = true;
  if (entry.pattern) out.pattern = entry.pattern;
  return out;
}

function entriesOf(module) {
  return REGISTRY.filter(entry => entry.module === module && !HIDDEN_KEYS.has(`${module}.${entry.key}`));
}

function sectionsFor(module) {
  const entries = entriesOf(module);
  const byKey = new Map(entries.map(entry => [entry.key, entry]));
  const used = new Set(['enabled']);
  const result = [];

  for (const section of SECTIONS[module] || []) {
    const list = section.keys.map(key => byKey.get(key)).filter(Boolean);
    list.forEach(entry => used.add(entry.key));
    if (list.length) result.push({ id: section.id, title: section.title, description: section.description, entries: list.map(plain) });
  }

  const isScoped = key => {
    if (module === 'antinuke') return NUKE_EVENTS.some(event => key.startsWith(`${event.id}.`));
    if (module === 'automod') return FILTERS.some(filter => key.startsWith(`${filter.id}.`));
    return false;
  };

  const rest = entries.filter(entry => !used.has(entry.key) && !isScoped(entry.key));
  if (rest.length) result.push({ id: 'other', title: 'Other', description: '', entries: rest.map(plain) });
  return result;
}

function eventsFor() {
  const byKey = new Map(entriesOf('antinuke').map(entry => [entry.key, entry]));
  return NUKE_EVENTS.map(event => ({
    id: event.id,
    label: event.label,
    entries: ['enabled', 'limit', 'seconds', 'punishment'].map(suffix => plain(byKey.get(`${event.id}.${suffix}`)))
  }));
}

function filtersFor() {
  const entries = entriesOf('automod');
  return FILTERS.map(filter => ({
    id: filter.id,
    label: filter.label,
    entries: entries.filter(entry => entry.key.startsWith(`${filter.id}.`)).map(plain)
  }));
}

module.exports = { SECTIONED_MODULES, sectionsFor, eventsFor, filtersFor, entriesOf, HIDDEN_KEYS };
