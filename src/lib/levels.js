const { AttachmentBuilder } = require('discord.js');
const prisma = require('./db');
const { buildRankCard } = require('./rankCard');
const { v2Message } = require('./components');
const { renderPlaceholders } = require('./placeholders');
const { levelFromXp } = require('./xpCurve');
const { isGuildPremium } = require('./permissions');
const { LIMITS } = require('../config/limits');
const { MAX_LEVEL_FOR_REWARDS } = require('../config/levels');

async function getSettings(guildId) {
  const settings = await prisma.levelSettings.findUnique({ where: { guildId }, include: { roleRewards: true } });
  if (settings) return settings;
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  return prisma.levelSettings.create({ data: { guildId }, include: { roleRewards: true } });
}

async function updateSettings(guildId, data) {
  await getSettings(guildId);
  return prisma.levelSettings.update({ where: { guildId }, data });
}

function validateRange(xpMin, xpMax) {
  if (!Number.isInteger(xpMin) || !Number.isInteger(xpMax)) return { ok: false, error: 'invalid-range' };
  if (xpMin < 1 || xpMax < xpMin) return { ok: false, error: 'invalid-range' };
  return { ok: true };
}

function validateCooldown(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) return { ok: false, error: 'invalid-cooldown' };
  return { ok: true };
}

async function addRoleReward(guildId, level, roleId) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL_FOR_REWARDS) return { ok: false, error: 'invalid-level' };

  const settings = await getSettings(guildId);
  const existing = settings.roleRewards.find(reward => reward.level === level);
  if (existing) return { ok: false, error: 'duplicate-level' };

  const premium = await isGuildPremium(guildId);
  const limit = premium ? LIMITS.premium.levelRoleRewards : LIMITS.free.levelRoleRewards;
  if (settings.roleRewards.length >= limit) return { ok: false, error: 'limit-reached' };

  const reward = await prisma.levelRoleReward.create({ data: { settingsId: settings.id, level, roleId } });
  return { ok: true, reward };
}

async function removeRoleReward(guildId, level) {
  const settings = await getSettings(guildId);
  const existing = settings.roleRewards.find(reward => reward.level === level);
  if (!existing) return { ok: false, error: 'not-found' };

  await prisma.levelRoleReward.delete({ where: { id: existing.id } });
  return { ok: true };
}

async function getMember(guildId, userId) {
  const member = await prisma.memberLevel.findUnique({ where: { guildId_userId: { guildId, userId } } });
  if (member) return member;
  return prisma.memberLevel.create({ data: { guildId, userId } });
}

async function getRank(guildId, userId) {
  const member = await getMember(guildId, userId);
  const higher = await prisma.memberLevel.count({ where: { guildId, xp: { gt: member.xp } } });
  return { member, rank: higher + 1 };
}

async function getLeaderboard(guildId, limit = 10) {
  return prisma.memberLevel.findMany({ where: { guildId }, orderBy: { xp: 'desc' }, take: limit });
}

function levelUpContext({ member, guild, level, rank }) {
  return {
    user: `<@${member.id}>`,
    user_name: member.user.username,
    user_tag: member.user.tag || member.user.username,
    user_id: member.id,
    server_name: guild.name,
    member_count: guild.memberCount,
    level,
    rank
  };
}

async function syncRoleRewards(member, settings, newLevel) {
  const due = settings.roleRewards.filter(reward => reward.level <= newLevel && !member.roles.cache.has(reward.roleId));
  for (const reward of due) {
    await member.roles.add(reward.roleId).catch(() => {});
  }
}

async function announceLevelUp({ member, guild, channel, settings, newLevel, rank }) {
  if (!settings.levelUpEnabled) return;

  const targetChannel = settings.levelUpChannelId ? guild.channels.cache.get(settings.levelUpChannelId) : channel;
  if (!targetChannel) return;

  const context = levelUpContext({ member, guild, level: newLevel, rank });
  const rendered = renderPlaceholders(settings.levelUpMessage, context);
  await targetChannel.send(v2Message([rendered], { allowedMentions: { parse: ['users'] } })).catch(() => {});
}

function xpMultiplier(settings, member, channelId) {
  const entries = Array.isArray(settings.xpMultipliers) ? settings.xpMultipliers : [];
  const roleValues = entries.filter(entry => entry.type === 'role' && member.roles.cache.has(entry.id)).map(entry => entry.multiplier);
  const role = roleValues.length ? Math.max(...roleValues) : 1;
  const channelEntry = entries.find(entry => entry.type === 'channel' && entry.id === channelId);
  const channel = channelEntry ? channelEntry.multiplier : 1;
  return (settings.globalMultiplier || 1) * role * channel;
}

function hasNoXpRole(settings, member) {
  return (settings.noXpRoleIds || []).some(id => member.roles.cache.has(id));
}

async function awardXp({ member, guild, channel, settings, gained, counters }) {
  const existing = await getMember(guild.id, member.id);
  const newXp = existing.xp + gained;
  const before = levelFromXp(existing.xp);
  const after = levelFromXp(newXp);

  await prisma.memberLevel.update({
    where: { guildId_userId: { guildId: guild.id, userId: member.id } },
    data: { xp: newXp, ...counters }
  });

  if (after.level > before.level) {
    const { rank } = await getRank(guild.id, member.id);
    await syncRoleRewards(member, settings, after.level).catch(() => {});
    await announceLevelUp({ member, guild, channel, settings, newLevel: after.level, rank });
  }
}

async function addXpFromMessage(message) {
  if (!message.member) return;

  const settings = await getSettings(message.guild.id);
  if (!settings.enabled) return;
  if (settings.ignoredChannelIds.includes(message.channelId)) return;
  if (hasNoXpRole(settings, message.member)) return;

  const existing = await getMember(message.guild.id, message.author.id);
  if (existing.lastXpAt) {
    const elapsedSeconds = (Date.now() - existing.lastXpAt.getTime()) / 1000;
    if (elapsedSeconds < settings.cooldownSeconds) return;
  }

  const base = Math.floor(Math.random() * (settings.xpMax - settings.xpMin + 1)) + settings.xpMin;
  const gained = Math.max(1, Math.round(base * xpMultiplier(settings, message.member, message.channelId)));

  await awardXp({
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    settings,
    gained,
    counters: { messages: { increment: 1 }, lastXpAt: new Date() }
  });
}

let voiceTickRunning = false;

async function runVoiceTick(client) {
  if (voiceTickRunning) return;
  voiceTickRunning = true;

  try {
    for (const guild of client.guilds.cache.values()) {
      const channels = guild.channels.cache.filter(channel => channel.isVoiceBased() && channel.members.size > 0);
      if (!channels.size) continue;

      const settings = await getSettings(guild.id).catch(() => null);
      if (!settings || !settings.enabled || !settings.voiceXpEnabled) continue;

      for (const channel of channels.values()) {
        if (guild.afkChannelId === channel.id) continue;
        if (settings.ignoredChannelIds.includes(channel.id)) continue;

        const humans = channel.members.filter(member => !member.user.bot);
        if (settings.voiceRequireOthers && humans.size < 2) continue;

        for (const member of humans.values()) {
          if (member.voice.selfDeaf || member.voice.serverDeaf) continue;
          if (hasNoXpRole(settings, member)) continue;

          const gained = Math.max(1, Math.round(settings.voiceXpPerMinute * xpMultiplier(settings, member, channel.id)));
          await awardXp({
            member,
            guild,
            channel: null,
            settings,
            gained,
            counters: { voiceMinutes: { increment: 1 } }
          }).catch(error => console.error('Voice XP award failed:', error));
        }
      }
    }
  } finally {
    voiceTickRunning = false;
  }
}

function startVoiceXp(client) {
  setInterval(() => {
    runVoiceTick(client).catch(error => console.error('Voice XP tick failed:', error));
  }, 60 * 1000);
}

async function buildRankReply({ guild, user, settings }) {
  const { member, rank } = await getRank(guild.id, user.id);
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(member.xp);

  const summary = [
    `**${user.username}**'s rank`,
    `Level **${level}** • Rank **#${rank}** • ${member.xp.toLocaleString()} total XP`,
    `${formatProgressBar(xpIntoLevel, xpForNextLevel)} ${xpIntoLevel}/${xpForNextLevel} XP to level ${level + 1}`
  ];

  if (!settings.rankCardEnabled) return v2Message(summary);

  try {
    const premium = await isGuildPremium(guild.id);
    const buffer = await buildRankCard({
      username: user.username,
      avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
      level,
      rank,
      xpIntoLevel,
      xpForNextLevel,
      totalXp: member.xp,
      accent: settings.rankCardAccent,
      backgroundUrl: premium ? settings.rankCardBackground : null
    });
    return v2Message([`${user}`], {
      imageUrl: 'attachment://rank.png',
      files: [new AttachmentBuilder(buffer, { name: 'rank.png' })],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error('Failed to build rank card:', error);
    return v2Message(summary);
  }
}

function formatProgressBar(current, total, size = 12) {
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  const filled = Math.round(ratio * size);
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
}

module.exports = {
  getSettings,
  updateSettings,
  validateRange,
  validateCooldown,
  addRoleReward,
  removeRoleReward,
  getMember,
  getRank,
  getLeaderboard,
  addXpFromMessage,
  startVoiceXp,
  buildRankReply,
  formatProgressBar
};
