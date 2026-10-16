const { loadConfig, isMemberTrusted, addTimer, cancelTimer } = require('./store');
const { punish } = require('./punish');
const { lockServer, unlockServer } = require('./lockdown');
const { securityLog } = require('./alerts');
const verification = require('./verification');
const { em } = require('../emojis');

const JOIN_HISTORY_MS = 30 * 60 * 1000;
const joins = new Map();
const raidUntil = new Map();

const DAY = 24 * 60 * 60 * 1000;

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
}

function trackJoin(guildId, member) {
  const now = Date.now();
  const list = (joins.get(guildId) || []).filter(item => now - item.t < JOIN_HISTORY_MS);
  list.push({ t: now, id: member.id, name: normalizeName(member.user.username), created: member.user.createdTimestamp });
  joins.set(guildId, list);
  return list;
}

function isRaid(guildId) {
  return (raidUntil.get(guildId) || 0) > Date.now();
}

function joinStats(guildId, windowSeconds) {
  const now = Date.now();
  const list = joins.get(guildId) || [];
  return {
    inWindow: list.filter(item => now - item.t < windowSeconds * 1000).length,
    lastHour: list.length,
    raid: isRaid(guildId),
    raidEndsAt: raidUntil.get(guildId) || null
  };
}

function scoreJoin(member, list, config) {
  const reasons = [];
  let score = 0;
  const now = Date.now();
  const age = now - member.user.createdTimestamp;

  if (config.ageBypassDays > 0 && age >= config.ageBypassDays * DAY) return { score: 0, reasons: ['account is old enough to skip scoring'] };

  if (age < 7 * DAY && config.riskNewAccount) {
    score += config.riskNewAccount;
    reasons.push(`account under 7 days old (+${config.riskNewAccount})`);
  }
  if (age < DAY && config.riskVeryNewAccount) {
    score += config.riskVeryNewAccount;
    reasons.push(`account under 24 hours old (+${config.riskVeryNewAccount})`);
  }
  if (!member.user.avatar && config.riskNoAvatar) {
    score += config.riskNoAvatar;
    reasons.push(`no avatar (+${config.riskNoAvatar})`);
  }

  const key = normalizeName(member.user.username);
  const similar = list.filter(item => item.id !== member.id && key.length >= 3 && item.name === key && now - item.t < 10 * 60 * 1000).length + 1;
  if (similar >= config.similarNameCount && config.riskSimilarName) {
    score += config.riskSimilarName;
    reasons.push(`${similar} joiners with similar names (+${config.riskSimilarName})`);
  }

  const burst = list.filter(item => now - item.t < 30 * 1000).length;
  if (burst >= config.burstJoins && config.riskJoinBurst) {
    score += config.riskJoinBurst;
    reasons.push(`${burst} joins in 30 seconds (+${config.riskJoinBurst})`);
  }

  const windowMs = config.createdTogetherMinutes * 60 * 1000;
  const cluster = list.filter(item => Math.abs(item.created - member.user.createdTimestamp) <= windowMs).length;
  if (cluster >= config.createdTogetherCount && config.riskCreatedTogether) {
    score += config.riskCreatedTogether;
    reasons.push(`${cluster} recent accounts created within ${config.createdTogetherMinutes} minutes of each other (+${config.riskCreatedTogether})`);
  }

  if (member.user.flags && member.user.flags.bitfield > 0 && config.riskBadgeBonus) {
    score -= config.riskBadgeBonus;
    reasons.push(`has Discord badges (-${config.riskBadgeBonus})`);
  }

  return { score: Math.max(0, score), reasons };
}

function gateCheck(member, config) {
  const name = `${member.user.username} ${member.user.globalName || ''}`;

  if (config.blockInviteUsernames && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/?\S*/i.test(name)) {
    return { action: config.inviteUsernameAction, reason: 'username advertises a Discord invite' };
  }

  for (const pattern of config.usernamePatterns) {
    try {
      if (new RegExp(pattern, 'i').test(name)) return { action: config.usernamePatternAction, reason: `username matches /${pattern}/` };
    } catch {
      continue;
    }
  }

  if (config.minAccountAgeDays > 0 && Date.now() - member.user.createdTimestamp < config.minAccountAgeDays * DAY) {
    return { action: config.minAccountAgeAction, reason: `account younger than ${config.minAccountAgeDays} days` };
  }

  if (config.noAvatar && !member.user.avatar) return { action: config.noAvatarAction, reason: 'account has no avatar' };

  return null;
}

async function applyAction(member, action, reason, config, label) {
  if (!action || action === 'none') return { ok: true, applied: 'none' };

  if (action === 'verify') {
    const verified = await verification.requireVerification(member, reason);
    if (verified) return { ok: true, applied: 'verification required' };
    action = 'quarantine';
  }

  return punish({
    guild: member.guild,
    userId: member.id,
    action,
    reason: `${label}: ${reason}`,
    timeoutMinutes: config.timeoutMinutes,
    deleteSeconds: config.banDeleteMinutes * 60
  });
}

async function startRaid(guild, config, recent) {
  const until = Date.now() + config.raidMinutes * 60 * 1000;
  raidUntil.set(guild.id, until);
  await addTimer({ guildId: guild.id, kind: 'raid-end', targetId: guild.id, expiresAt: new Date(until) });

  const notes = [];
  if (config.pauseInvites && typeof guild.disableInvites === 'function') {
    await guild.disableInvites(true).then(() => notes.push('Invites paused.')).catch(() => notes.push('Could not pause invites (needs Manage Server).'));
  }
  if (config.lockChannels) {
    const locked = await lockServer(guild, { reason: 'Raid mode' });
    notes.push(`Locked ${locked} channels.`);
  }

  let punished = 0;
  if (config.punishRecentJoiners) {
    for (const item of recent) {
      const target = guild.members.cache.get(item.id) || (await guild.members.fetch(item.id).catch(() => null));
      if (!target || (await isMemberTrusted(target, 'antiraid'))) continue;
      const result = await applyAction(target, config.raidAction, 'part of a join raid', config, 'Anti-raid');
      if (result.ok && result.applied !== 'none') punished += 1;
    }
    notes.push(`Handled ${punished} of the ${recent.length} accounts that triggered it with **${config.raidAction}**.`);
  }

  await securityLog(guild, {
    module: 'antiraid',
    action: 'raid detected',
    severity: 'critical',
    detail: { joins: recent.length, window: config.joinWindowSeconds },
    lines: [
      `${recent.length} joins within ${config.joinWindowSeconds}s (limit ${config.joinThreshold}).`,
      `Raid mode is on for ${config.raidMinutes} minutes. New joiners get **${config.raidAction}**.`,
      ...notes,
      'End it early with `/antiraid end`.'
    ]
  });
}

async function endRaid(guild, by) {
  const config = (await loadConfig(guild.id)).antiraid;
  raidUntil.delete(guild.id);
  await cancelTimer(guild.id, 'raid-end');

  const notes = [];
  if (config.pauseInvites && typeof guild.disableInvites === 'function') {
    await guild.disableInvites(false).then(() => notes.push('Invites resumed.')).catch(() => {});
  }
  if (config.lockChannels) {
    const unlocked = await unlockServer(guild, { reason: 'Raid mode ended' });
    notes.push(`Unlocked ${unlocked} channels.`);
  }

  await securityLog(guild, { module: 'antiraid', action: 'raid mode ended', executorId: by || null, lines: notes });
}

async function handleJoin(member) {
  if (member.user.bot) return;
  const guild = member.guild;
  const config = (await loadConfig(guild.id)).antiraid;
  if (!config.enabled) return;
  if (await isMemberTrusted(member, 'antiraid')) return;

  const list = trackJoin(guild.id, member);
  const now = Date.now();
  const recent = list.filter(item => now - item.t < config.joinWindowSeconds * 1000);

  if (recent.length >= config.joinThreshold && !isRaid(guild.id)) {
    await startRaid(guild, config, recent);
    return;
  }

  if (isRaid(guild.id)) {
    const result = await applyAction(member, config.raidAction, 'joined during raid mode', config, 'Anti-raid');
    await securityLog(guild, {
      module: 'antiraid',
      action: 'raid-mode join handled',
      severity: 'warning',
      targetId: member.id,
      lines: [`Applied **${result.applied}**.`]
    });
    return;
  }

  const gate = gateCheck(member, config);
  if (gate) {
    const result = await applyAction(member, gate.action, gate.reason, config, 'Join gate');
    await securityLog(guild, {
      module: 'antiraid',
      action: 'join gate',
      severity: 'warning',
      targetId: member.id,
      lines: [`${gate.reason}.`, `Applied **${result.applied}**${result.ok ? '' : ` (failed: ${result.error})`}.`]
    });
    return;
  }

  if (config.riskEnabled) {
    const { score, reasons } = scoreJoin(member, list, config);
    if (score >= config.riskThreshold) {
      const result = await applyAction(member, config.riskAction, `risk score ${score}`, config, 'Risk score');
      await securityLog(guild, {
        module: 'antiraid',
        action: 'risky join',
        severity: 'warning',
        targetId: member.id,
        detail: { score, reasons },
        lines: [`Score **${score}** (threshold ${config.riskThreshold}).`, ...reasons.map(reason => `• ${reason}`), `Applied **${result.applied}**${result.ok ? '' : ` (failed: ${result.error})`}.`]
      });
    }
  }
}

module.exports = { handleJoin, startRaid, endRaid, isRaid, joinStats, scoreJoin };
