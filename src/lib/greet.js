const { AttachmentBuilder, AuditLogEvent } = require('discord.js');
const prisma = require('./db');
const { blocksMessage } = require('./components');
const { isGuildPremium } = require('./permissions');
const { renderPlaceholders, memberContext, userContext } = require('./placeholders');
const { buildMemberCard } = require('./welcomeCard');
const { MAX_BLOCKS, MAX_BUTTONS_PER_BLOCK, MAX_IMAGES_PER_BLOCK } = require('../config/greet');

const GREET_ALLOWED_MENTIONS = { parse: ['users', 'roles'] };

async function getSettings(guildId) {
  const settings = await prisma.greetSettings.findUnique({ where: { guildId } });
  if (settings) return settings;
  return prisma.greetSettings.create({ data: { guildId } });
}

async function updateSettings(guildId, data) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  await getSettings(guildId);
  return prisma.greetSettings.update({ where: { guildId }, data });
}

function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) return { ok: false, error: 'invalid-blocks' };
  if (blocks.length === 0) return { ok: false, error: 'empty-blocks' };
  if (blocks.length > MAX_BLOCKS) return { ok: false, error: 'too-many-blocks' };

  for (const block of blocks) {
    if (!block || typeof block !== 'object' || typeof block.type !== 'string') return { ok: false, error: 'invalid-blocks' };

    if (block.type === 'text') {
      if (typeof block.content !== 'string' || !block.content.trim()) return { ok: false, error: 'invalid-blocks' };
      if (block.content.length > 2000) return { ok: false, error: 'message-too-long' };
    } else if (block.type === 'section') {
      if (typeof block.content !== 'string' || !block.content.trim()) return { ok: false, error: 'invalid-blocks' };
      if (block.content.length > 2000) return { ok: false, error: 'message-too-long' };
      if (block.thumbnail && typeof block.thumbnail !== 'string') return { ok: false, error: 'invalid-blocks' };
    } else if (block.type === 'image') {
      const urls = Array.isArray(block.urls) ? block.urls : typeof block.url === 'string' ? [block.url] : null;
      if (!urls || urls.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (urls.length > MAX_IMAGES_PER_BLOCK) return { ok: false, error: 'too-many-images' };
      for (const url of urls) {
        if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return { ok: false, error: 'invalid-blocks' };
      }
    } else if (block.type === 'separator') {
    } else if (block.type === 'footer') {
      if (block.content !== undefined && typeof block.content !== 'string') return { ok: false, error: 'invalid-blocks' };
      if (block.content && block.content.length > 200) return { ok: false, error: 'message-too-long' };
    } else if (block.type === 'buttons') {
      if (!Array.isArray(block.buttons) || block.buttons.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (block.buttons.length > MAX_BUTTONS_PER_BLOCK) return { ok: false, error: 'too-many-buttons' };
      for (const button of block.buttons) {
        if (!button || typeof button.label !== 'string' || !button.label.trim()) return { ok: false, error: 'invalid-blocks' };
        if (typeof button.url !== 'string' || !/^https?:\/\//.test(button.url)) return { ok: false, error: 'invalid-blocks' };
      }
    } else {
      return { ok: false, error: 'invalid-blocks' };
    }
  }

  return { ok: true };
}

function renderBlocks(blocks, context) {
  return (blocks || []).map(block => {
    if (block.type === 'text' || block.type === 'section' || block.type === 'footer') {
      return { ...block, content: renderPlaceholders(block.content, context) };
    }
    return block;
  });
}

async function buildMemberEventPayload({ kind, member, user, guild, context, blocks, cardEnabled, cardBackground }) {
  const rendered = renderBlocks(blocks, context);
  const options = { allowedMentions: GREET_ALLOWED_MENTIONS };
  let files;

  if (cardEnabled) {
    try {
      const avatarUrl = member ? member.displayAvatarURL({ extension: 'png', size: 256 }) : user.displayAvatarURL({ extension: 'png', size: 256 });
      const buffer = await buildMemberCard({
        kind,
        username: user.username,
        avatarUrl,
        serverName: guild.name,
        memberCount: guild.memberCount,
        backgroundUrl: cardBackground || null
      });
      const filename = `${kind}-card.png`;
      files = [new AttachmentBuilder(buffer, { name: filename })];
      rendered.unshift({ type: 'image', urls: [`attachment://${filename}`] });
    } catch (error) {
      console.error(`Failed to build ${kind} card:`, error);
    }
  }

  if (files) options.files = files;
  return blocksMessage(rendered, options);
}

async function sendMemberEvent(args) {
  const payload = await buildMemberEventPayload(args);
  await args.channel.send(payload).catch(error => {
    console.error(`Failed to send ${args.kind} message:`, error);
  });
}

async function handleGuildMemberAdd(member) {
  const settings = await getSettings(member.guild.id);

  if (settings.joinEnabled && settings.joinChannelId) {
    const channel = member.guild.channels.cache.get(settings.joinChannelId);
    if (channel) {
      const premium = await isGuildPremium(member.guild.id);
      await sendMemberEvent({
        kind: 'join',
        channel,
        member,
        user: member.user,
        guild: member.guild,
        context: memberContext(member),
        blocks: settings.joinBlocks,
        cardEnabled: settings.joinCardEnabled,
        cardBackground: premium ? settings.joinCardBackground : null
      });
    }
  }

  if (settings.joinDmEnabled) {
    const rendered = renderBlocks(settings.joinDmBlocks, memberContext(member));
    await member.send(blocksMessage(rendered, { allowedMentions: GREET_ALLOWED_MENTIONS })).catch(() => {});
  }
}

async function handleGuildMemberRemove(member) {
  const settings = await getSettings(member.guild.id);
  if (!settings.leaveEnabled || !settings.leaveChannelId) return;

  const channel = member.guild.channels.cache.get(settings.leaveChannelId);
  if (!channel) return;

  await sendMemberEvent({
    kind: 'leave',
    channel,
    member,
    user: member.user,
    guild: member.guild,
    context: memberContext(member),
    blocks: settings.leaveBlocks,
    cardEnabled: false
  });
}

async function lookupBanAuditLog(guild, userId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
    const entry = logs.entries.find(item => item.target?.id === userId);
    if (!entry) return { reason: 'No reason provided', moderator: 'Unknown' };
    return {
      reason: entry.reason || 'No reason provided',
      moderator: entry.executor ? entry.executor.tag || entry.executor.username : 'Unknown'
    };
  } catch {
    return { reason: 'No reason provided', moderator: 'Unknown' };
  }
}

async function handleGuildBanAdd(ban) {
  const { guild, user } = ban;
  const settings = await getSettings(guild.id);
  if (!settings.banEnabled && !settings.banDmEnabled) return;

  const { reason, moderator } = await lookupBanAuditLog(guild, user.id);
  const context = { ...userContext(user, guild), reason, moderator };

  if (settings.banEnabled && settings.banChannelId) {
    const channel = guild.channels.cache.get(settings.banChannelId);
    if (channel) {
      const rendered = renderBlocks(settings.banBlocks, context);
      await channel.send(blocksMessage(rendered, { allowedMentions: GREET_ALLOWED_MENTIONS })).catch(error => {
        console.error('Failed to send ban message:', error);
      });
    }
  }

  if (settings.banDmEnabled) {
    const rendered = renderBlocks(settings.banDmBlocks, context);
    await user.send(blocksMessage(rendered, { allowedMentions: GREET_ALLOWED_MENTIONS })).catch(() => {});
  }
}

module.exports = {
  getSettings,
  updateSettings,
  validateBlocks,
  renderBlocks,
  buildMemberEventPayload,
  lookupBanAuditLog,
  handleGuildMemberAdd,
  handleGuildMemberRemove,
  handleGuildBanAdd
};
