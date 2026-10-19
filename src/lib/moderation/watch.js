const prisma = require('../db');
const { loadConfig } = require('../security/store');
const { v2Message, SEPARATOR } = require('../components');
const { em } = require('../emojis');

const cache = new Map();
const alerted = new Map();

async function watchedIds(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < 60000) return hit.ids;
  const rows = await prisma.modWatch.findMany({ where: { guildId }, select: { userId: true } });
  const ids = new Set(rows.map(row => row.userId));
  cache.set(guildId, { ids, at: Date.now() });
  return ids;
}

function forget(guildId) {
  cache.delete(guildId);
}

async function alertWatched(guild, user, trigger) {
  const key = `${guild.id}:${user.id}`;
  if (Date.now() - (alerted.get(key) || 0) < 3600000) return;
  const watch = await prisma.modWatch.findUnique({ where: { guildId_userId: { guildId: guild.id, userId: user.id } } });
  if (!watch) return;

  const config = (await loadConfig(guild.id)).moderation;
  const core = (await loadConfig(guild.id)).core;
  const id = config.watchChannelId || config.logChannelId || core.logChannelId;
  const channel = id ? guild.channels.cache.get(id) : null;
  if (!channel || !channel.isTextBased()) return;
  alerted.set(key, Date.now());

  const [notes, cases] = await Promise.all([
    prisma.modNote.findMany({ where: { guildId: guild.id, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
    prisma.modCase.count({ where: { guildId: guild.id, userId: user.id } })
  ]);
  const lines = [`### ${em.modWarn} Watchlist: ${trigger}`, `**User:** <@${user.id}> (\`${user.id}\`)`, `**Reason:** ${watch.reason || 'No reason given'}`, `**Cases on record:** ${cases}`];
  if (notes.length) lines.push(SEPARATOR, ...notes.map(note => `• ${note.content.slice(0, 200)}`));
  await channel.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
}

async function checkMessage(message) {
  if (!message.guild || message.author.bot) return;
  const ids = await watchedIds(message.guild.id);
  if (ids.has(message.author.id)) await alertWatched(message.guild, message.author, 'sent a message');
}

async function checkJoin(member) {
  const ids = await watchedIds(member.guild.id);
  if (ids.has(member.id)) await alertWatched(member.guild, member.user, 'joined the server');
}

module.exports = { checkMessage, checkJoin, forget };
