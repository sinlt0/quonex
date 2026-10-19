const { AttachmentBuilder, AuditLogEvent } = require('discord.js');
const { loadConfig } = require('../security/store');
const { v2Message, SEPARATOR } = require('../components');
const { em } = require('../emojis');

const quiet = new Map();
const quietChannels = new Map();
const GHOST_WINDOW = 30 * 60 * 1000;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function prune(map) {
  const now = Date.now();
  for (const [key, expires] of map) if (expires < now) map.delete(key);
}

function markQuiet(messageId) {
  prune(quiet);
  quiet.set(messageId, Date.now() + 30000);
}

function markQuietChannel(channelId) {
  prune(quietChannels);
  quietChannels.set(channelId, Date.now() + 20000);
}

function clip(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function quote(text) {
  return clip(text, 1400)
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

async function target(guild, channel) {
  const config = (await loadConfig(guild.id)).moderation;
  if (!config.msgLogChannelId) return null;
  if (channel && (channel.id === config.msgLogChannelId || config.logIgnoreChannelIds.includes(channel.id) || (channel.parentId && config.logIgnoreChannelIds.includes(channel.parentId)))) return null;
  const out = guild.channels.cache.get(config.msgLogChannelId);
  return out && out.isTextBased() ? { config, out } : null;
}

function pingedOthers(message) {
  const users = message.mentions.users.filter(user => !user.bot && user.id !== message.author.id);
  return { users, roles: message.mentions.roles, everyone: message.mentions.everyone };
}

function pingText(found) {
  const parts = [...found.users.values()].slice(0, 5).map(user => `<@${user.id}>`);
  for (const role of [...found.roles.values()].slice(0, 3)) parts.push(`<@&${role.id}>`);
  if (found.everyone) parts.push('@everyone');
  return parts.join(' ');
}

async function findDeleter(message) {
  const entries = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 }).catch(() => null);
  if (!entries) return null;
  const entry = entries.entries.find(item => item.target && item.target.id === message.author.id && item.extra && item.extra.channel && item.extra.channel.id === message.channelId && Date.now() - item.createdTimestamp < 6000);
  return entry ? entry.executor : null;
}

async function fetchFiles(message) {
  const files = [];
  for (const attachment of message.attachments.values()) {
    if (files.length >= MAX_FILES) break;
    if (attachment.size > MAX_FILE_BYTES) continue;
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!response || !response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    files.push(new AttachmentBuilder(buffer, { name: attachment.name || 'file' }));
  }
  return files;
}

function ignored(message, config) {
  if (message.author && message.author.bot && config.logIgnoreBots) return true;
  return false;
}

async function logDelete(message) {
  if (!message.guild || message.partial || !message.author) return;
  if (quiet.has(message.id)) return;
  const dest = await target(message.guild, message.channel);
  if (!dest || ignored(message, dest.config)) return;

  const found = pingedOthers(message);
  const hasPing = found.users.size > 0 || found.roles.size > 0 || found.everyone;
  const ghost = dest.config.ghostPing && hasPing && Date.now() - message.createdTimestamp < GHOST_WINDOW;
  if (!dest.config.logDeletes && !ghost) return;

  const deleter = await findDeleter(message);
  const lines = [`### ${ghost ? `${em.modWarn} Ghost ping` : `${em.modPurge} Message deleted`}`, `**Author:** <@${message.author.id}> (\`${message.author.id}\`)`, `**Channel:** <#${message.channelId}> · sent <t:${Math.floor(message.createdTimestamp / 1000)}:R>`];
  if (deleter && deleter.id !== message.author.id) lines.push(`**Deleted by:** <@${deleter.id}>`);
  if (ghost) lines.push(`**Pinged:** ${pingText(found)}`);
  if (message.content) lines.push(SEPARATOR, quote(message.content));
  if (message.attachments.size) lines.push(`${em.modCase} ${[...message.attachments.values()].slice(0, 5).map(a => a.name).join(', ')}`);
  if (message.stickers.size) lines.push(`Sticker: ${message.stickers.map(s => s.name).join(', ')}`);

  await dest.out.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
  if (dest.config.logAttachments && message.attachments.size) {
    const files = await fetchFiles(message);
    if (files.length) await dest.out.send({ content: `Attachments from the message above (<@${message.author.id}>)`, files, allowedMentions: { parse: [] } }).catch(() => {});
  }
}

async function logEdit(oldMessage, newMessage) {
  if (!newMessage.guild || !newMessage.author || oldMessage.partial || oldMessage.content === null) return;
  if (oldMessage.content === newMessage.content) return;
  const dest = await target(newMessage.guild, newMessage.channel);
  if (!dest || ignored(newMessage, dest.config)) return;

  const before = pingedOthers(oldMessage);
  const after = pingedOthers(newMessage);
  const removed = new Set([...before.users.keys()].filter(id => !after.users.has(id)));
  const rolesRemoved = [...before.roles.keys()].some(id => !after.roles.has(id));
  const ghost = dest.config.ghostPing && (removed.size > 0 || rolesRemoved) && Date.now() - newMessage.createdTimestamp < GHOST_WINDOW;
  if (!dest.config.logEdits && !ghost) return;

  const lines = [`### ${ghost ? `${em.modWarn} Ghost ping (edited out)` : `${em.modCase} Message edited`}`, `**Author:** <@${newMessage.author.id}> · **Channel:** <#${newMessage.channelId}> · [Jump](${newMessage.url})`];
  if (ghost) lines.push(`**Removed pings:** ${[...removed].map(id => `<@${id}>`).join(' ')}`);
  lines.push(SEPARATOR, '**Before**', quote(oldMessage.content || '*empty*'), '**After**', quote(newMessage.content || '*empty*'));
  await dest.out.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
}

async function logBulk(messages, channel) {
  if (!channel.guild) return;
  if (quietChannels.has(channel.id)) return;
  const dest = await target(channel.guild, channel);
  if (!dest || !dest.config.logBulkDeletes) return;

  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const transcript = sorted
    .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author ? `${m.author.tag} (${m.author.id})` : 'unknown author'}: ${m.partial ? '(not cached)' : m.content || ''}${m.attachments && m.attachments.size ? ` [${m.attachments.size} attachment(s)]` : ''}`)
    .join('\n')
    .slice(0, 900000);
  const lines = [`### ${em.modPurge} Bulk delete`, `**${messages.size}** messages removed in <#${channel.id}>`];
  await dest.out.send(v2Message(lines, { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
  if (transcript) await dest.out.send({ files: [new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `bulk-delete-${channel.id}.txt` })] }).catch(() => {});
}

module.exports = { logDelete, logEdit, logBulk, markQuiet, markQuietChannel };
