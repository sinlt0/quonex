const { PermissionFlagsBits } = require('discord.js');
const { loadConfig, isMemberTrusted, isChannelExempt, addStrike } = require('./store');
const { punish } = require('./punish');
const { securityLog } = require('./alerts');
const { v2Message } = require('../components');
const { FILTERS } = require('../../config/security');
const { em } = require('../emojis');

const heat = new Map();
const history = new Map();
const inviteCache = new Map();
const wordCache = new Map();

const INVITE_PATTERN = /(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.io|discord\.me|dsc\.gg)\/([\w-]+)/gi;
const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const EMOJI_PATTERN = /<a?:\w+:\d+>|\p{Extended_Pictographic}/gu;
const ZALGO_PATTERN = /[̀-ͯ҃-҉᷀-᷿⃐-⃿︠-︯]/g;
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

function currentHeat(entry, decaySeconds) {
  if (!entry) return 0;
  const elapsed = (Date.now() - entry.at) / 1000;
  return Math.max(0, entry.value - (elapsed / decaySeconds) * 100);
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ​-‏⁠﻿]/g, '')
    .replace(/[0134578@$!]/g, char => LEET[char] || char);
}

function compileWords(list) {
  const key = list.join('\n');
  const cached = wordCache.get(key);
  if (cached) return cached;

  const patterns = [];
  for (const item of list) {
    const clean = normalize(item).trim();
    if (!clean) continue;
    const escaped = clean.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const body = clean.includes('*') ? escaped : `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    try {
      patterns.push(new RegExp(body, 'iu'));
    } catch {
      continue;
    }
  }
  wordCache.set(key, patterns);
  if (wordCache.size > 200) wordCache.delete(wordCache.keys().next().value);
  return patterns;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function domainMatches(domain, list) {
  return list.some(item => {
    const clean = item.replace(/^www\./, '');
    return domain === clean || domain.endsWith(`.${clean}`);
  });
}

async function ownInviteCodes(guild) {
  const cached = inviteCache.get(guild.id);
  if (cached && cached.expires > Date.now()) return cached.codes;

  const codes = new Set();
  if (guild.vanityURLCode) codes.add(guild.vanityURLCode.toLowerCase());
  const me = guild.members.me;
  if (me && me.permissions.has(PermissionFlagsBits.ManageGuild)) {
    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) for (const invite of invites.values()) codes.add(invite.code.toLowerCase());
  }
  inviteCache.set(guild.id, { codes, expires: Date.now() + 5 * 60 * 1000 });
  return codes;
}

function pushHistory(key, entry) {
  const list = (history.get(key) || []).filter(item => Date.now() - item.t < 5 * 60 * 1000);
  list.push(entry);
  history.set(key, list.slice(-30));
  return list;
}

async function evaluate(message, config, key, isEdit) {
  const hits = [];
  const content = message.content || '';
  const add = (id, reason) => {
    const filter = FILTERS.find(item => item.id === id);
    hits.push({ id, label: filter.label, heat: config[`${id}.heat`], reason });
  };

  if (!isEdit) {
    const list = pushHistory(key, { t: Date.now(), content: normalize(content).trim(), channelId: message.channelId, id: message.id });

    if (config['spam.enabled']) {
      const recent = list.filter(item => Date.now() - item.t < config['spam.seconds'] * 1000);
      if (recent.length >= config['spam.count']) add('spam', `${recent.length} messages in ${config['spam.seconds']}s`);
    }
    if (config['duplicate.enabled'] && content.trim()) {
      const same = list.filter(item => item.content && item.content === normalize(content).trim() && Date.now() - item.t < config['duplicate.seconds'] * 1000);
      if (same.length >= config['duplicate.count']) add('duplicate', `${same.length} identical messages`);
    }
  }

  if (config['mentions.enabled']) {
    const total = message.mentions.users.size + message.mentions.roles.size;
    if (total > config['mentions.max']) add('mentions', `${total} mentions`);
  }

  if (config['everyone.enabled'] && /@(everyone|here)/i.test(content)) add('everyone', 'mentions @everyone or @here');

  if (config['emojis.enabled']) {
    const count = (content.match(EMOJI_PATTERN) || []).length;
    if (count > config['emojis.max']) add('emojis', `${count} emojis`);
  }

  if (config['caps.enabled']) {
    const letters = content.replace(/[^\p{L}]/gu, '');
    if (letters.length >= config['caps.minLength']) {
      const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
      const percent = Math.round((upper / letters.length) * 100);
      if (percent >= config['caps.percent']) add('caps', `${percent}% capital letters`);
    }
  }

  if (config['newlines.enabled'] && content.split('\n').length > config['newlines.max']) add('newlines', `${content.split('\n').length} lines`);
  if (config['characters.enabled'] && content.length > config['characters.max']) add('characters', `${content.length} characters`);
  if (config['zalgo.enabled'] && (content.match(ZALGO_PATTERN) || []).length > 8) add('zalgo', 'glitch text');

  if (config['invites.enabled']) {
    const codes = [...content.matchAll(INVITE_PATTERN)].map(match => match[1].toLowerCase());
    if (codes.length) {
      let foreign = codes;
      if (config['invites.allowOwnServer']) {
        const own = await ownInviteCodes(message.guild);
        foreign = codes.filter(code => !own.has(code));
      }
      if (foreign.length) add('invites', 'posted a Discord invite');
    }
  }

  if (config['links.enabled']) {
    const urls = content.match(URL_PATTERN) || [];
    const list = config['links.list'];
    for (const url of urls) {
      const domain = domainOf(url);
      if (!domain) continue;
      const listed = domainMatches(domain, list);
      if ((config['links.mode'] === 'blocklist' && listed) || (config['links.mode'] === 'allowlist' && !listed)) {
        add('links', `link to ${domain}`);
        break;
      }
    }
  }

  if (config['words.enabled'] && config['words.list'].length && content) {
    const raw = content.toLowerCase();
    const normalized = normalize(content);
    const matched = compileWords(config['words.list']).find(pattern => pattern.test(raw) || pattern.test(normalized));
    if (matched) add('words', 'blocked word');
  }

  if (config['attachments.enabled'] && message.attachments.size) {
    if (message.attachments.size > config['attachments.max']) add('attachments', `${message.attachments.size} files`);
    const blocked = config['attachments.blockedExtensions'];
    const bad = [...message.attachments.values()].find(file => blocked.includes((file.name || '').split('.').pop().toLowerCase()));
    if (bad) add('attachments', `blocked file type (${bad.name})`);
  }

  return hits;
}

async function purgeRecent(message, key) {
  const list = history.get(key) || [];
  const ids = list.filter(item => item.channelId === message.channelId && Date.now() - item.t < 60 * 1000).map(item => item.id);
  if (ids.length > 1 && message.channel.bulkDelete) await message.channel.bulkDelete(ids, true).catch(() => {});
}

async function handleMessage(message, isEdit = false) {
  if (!message.guild || message.system || !message.member) return false;
  const guild = message.guild;
  const config = (await loadConfig(guild.id)).automod;
  if (!config.enabled) return false;
  if (message.author.bot && (config.ignoreBots || message.author.id === guild.client.user.id)) return false;
  if (isEdit && !config.scanEdits) return false;
  if (await isMemberTrusted(message.member, 'automod')) return false;
  if (await isChannelExempt(guild.id, message.channel, 'automod')) return false;

  const key = `${guild.id}:${message.author.id}`;
  const hits = await evaluate(message, config, key, isEdit);

  const previous = heat.get(key);
  let value = currentHeat(previous, config.decaySeconds);
  if (!isEdit) value += config.baseHeat;
  for (const hit of hits) value += hit.heat;
  value = Math.min(value, 200);

  const deleted = Boolean(hits.length && config.deleteMessages);
  if (deleted) {
    require('../moderation/msglog').markQuiet(message.id);
    await message.delete().catch(() => {});
  }

  if (value < 100) {
    heat.set(key, { value, at: Date.now() });
    return deleted;
  }

  heat.delete(key);
  const strikes = await addStrike(guild.id, message.author.id, config.strikeResetHours);
  const minutes = Math.min(config.maxTimeoutMinutes, Math.max(1, Math.round(config.timeoutMinutes * config.timeoutMultiplier ** (strikes - 1))));
  const reasonText = hits.length ? hits.map(hit => `${hit.label}: ${hit.reason}`).join('; ') : 'sending messages too fast';

  if (config.purgeOnPunish) await purgeRecent(message, key);

  const result = await punish({
    guild,
    userId: message.author.id,
    action: 'timeout',
    reason: `Auto-mod: ${reasonText}`,
    timeoutMinutes: minutes
  });

  let strikeNote = '';
  if (config.strikeAction !== 'none' && strikes >= config.strikeThreshold) {
    const extra = await punish({ guild, userId: message.author.id, action: config.strikeAction, reason: `Auto-mod: ${strikes} strikes` });
    strikeNote = `Strike action **${config.strikeAction}**: ${extra.ok ? 'done' : `failed (${extra.error})`}.`;
  }

  if (config.notify && result.ok) {
    const notice = await message.channel
      .send(v2Message([`${message.author}, slow down. You were timed out for ${minutes} minute${minutes === 1 ? '' : 's'}.`], { footer: false, allowedMentions: { users: [message.author.id] } }))
      .catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);
  }

  await securityLog(guild, {
    module: 'automod',
    action: 'member punished',
    severity: 'warning',
    targetId: message.author.id,
    detail: { hits: hits.map(hit => hit.id), strikes, minutes },
    lines: [
      `Channel: <#${message.channelId}>`,
      `Why: ${reasonText}`,
      `Strike **${strikes}**, ${result.ok ? `**${result.applied}**` : `timeout failed (${result.error})`}.`,
      strikeNote
    ].filter(Boolean)
  });
  return deleted;
}

module.exports = { handleMessage };
