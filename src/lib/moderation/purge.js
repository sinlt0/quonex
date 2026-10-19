const { PermissionFlagsBits } = require('discord.js');
const { securityLog } = require('../security/alerts');

const FILTERS = {
  all: () => true,
  bots: m => m.author.bot,
  humans: m => !m.author.bot,
  links: m => /https?:\/\/\S+/i.test(m.content),
  invites: m => /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i.test(m.content),
  attachments: m => m.attachments.size > 0,
  embeds: m => m.embeds.length > 0
};

function buildTest(sub, { userId, text }) {
  if (sub === 'user') return m => m.author.id === userId;
  if (sub === 'contains') {
    const needle = String(text).toLowerCase();
    return m => m.content.toLowerCase().includes(needle);
  }
  return FILTERS[sub];
}

async function runPurge({ guild, channel, moderatorId, config, sub, amount, userId, text }) {
  if (!channel || !channel.isTextBased() || !channel.bulkDelete) return { error: 'This channel does not support purging.' };
  const me = guild.members.me;
  if (!channel.permissionsFor(me).has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) return { error: 'I need Manage Messages and Read Message History here.' };
  const test = buildTest(sub, { userId, text });
  if (!test) return { error: 'Unknown purge type.' };
  amount = Math.min(amount, config.maxPurge);

    const cutoff = Date.now() - 14 * 86400000 + 60000;
    let before;
    let scanned = 0;
    const doomed = [];
    while (scanned < amount) {
      const batch = await channel.messages.fetch({ limit: Math.min(100, amount - scanned), ...(before ? { before } : {}) }).catch(() => null);
      if (!batch || !batch.size) break;
      scanned += batch.size;
      before = batch.last().id;
      let reachedOld = false;
      for (const message of batch.values()) {
        if (message.createdTimestamp < cutoff) {
          reachedOld = true;
          continue;
        }
        if (config.purgeKeepPinned && message.pinned) continue;
        if (test(message)) doomed.push(message);
      }
      if (reachedOld) break;
    }

    require('./msglog').markQuietChannel(channel.id);
    let deleted = 0;
    for (let i = 0; i < doomed.length; i += 100) {
      const result = await channel.bulkDelete(doomed.slice(i, i + 100), true).catch(() => null);
      if (result) deleted += result.size;
    }

    if (config.purgeLog && deleted) {
      await securityLog(guild, {
        module: 'moderation',
        action: 'purge',
        executorId: moderatorId,
        lines: [`Deleted ${deleted} message${deleted === 1 ? '' : 's'} in <#${channel.id}> (${sub})`]
      });
    }
  return { deleted };
}

module.exports = { runPurge, FILTERS };
