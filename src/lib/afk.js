const prisma = require('./db');
const { v2Message } = require('./components');
const { em } = require('./emojis');

const MAX_REASON_LENGTH = 200;
const MENTION_NOTICE_COOLDOWN_MS = 60_000;
const mentionNoticeCache = new Map();

function formatSince(since) {
  const minutes = Math.floor((Date.now() - since.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function setAfk(guildId, userId, reason) {
  const trimmed = (reason || '').trim().slice(0, MAX_REASON_LENGTH) || 'AFK';
  return prisma.afk.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { reason: trimmed, since: new Date() },
    create: { guildId, userId, reason: trimmed }
  });
}

async function clearAfk(guildId, userId) {
  await prisma.afk.deleteMany({ where: { guildId, userId } }).catch(() => {});
}

async function getAfk(guildId, userId) {
  return prisma.afk.findUnique({ where: { guildId_userId: { guildId, userId } } }).catch(() => null);
}

async function handleAfkReturn(message) {
  const existing = await getAfk(message.guild.id, message.author.id);
  if (!existing) return;

  await clearAfk(message.guild.id, message.author.id);

  const reply = await message
    .reply(v2Message([`${em.success} Welcome back, ${message.author}! Your AFK status has been removed.`], { allowedMentions: { parse: [] } }))
    .catch(() => null);

  if (reply) setTimeout(() => reply.delete().catch(() => {}), 8000);
}

async function notifyAfkMentions(message) {
  if (!message.mentions.users.size) return;

  const lines = [];
  for (const user of message.mentions.users.values()) {
    if (user.bot || user.id === message.author.id) continue;

    const cacheKey = `${message.channelId}:${user.id}`;
    const lastNotified = mentionNoticeCache.get(cacheKey);
    if (lastNotified && Date.now() - lastNotified < MENTION_NOTICE_COOLDOWN_MS) continue;

    const afk = await getAfk(message.guild.id, user.id);
    if (!afk) continue;

    mentionNoticeCache.set(cacheKey, Date.now());
    lines.push(`${em.arrow} **${user.username}** is AFK: ${afk.reason} (${formatSince(afk.since)})`);
  }

  if (!lines.length) return;
  await message.reply(v2Message(lines, { allowedMentions: { parse: [] } })).catch(() => {});
}

module.exports = { setAfk, clearAfk, getAfk, handleAfkReturn, notifyAfkMentions, MAX_REASON_LENGTH };
