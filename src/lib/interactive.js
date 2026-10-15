const { PermissionFlagsBits, MessageFlags, parseEmoji } = require('discord.js');
const prisma = require('./db');
const { blocksMessage, blocksContainer, v2Message } = require('./components');
const { renderPlaceholders, userContext } = require('./placeholders');
const { isGuildPremium } = require('./permissions');
const { LIMITS } = require('../config/limits');
const { DANGEROUS_PERMISSIONS } = require('../config/interactive');
const { rolesOf } = require('./interactiveBlocks');
const { levelFromXp } = require('./xpCurve');

const NO_PINGS = { parse: [] };
const MESSAGE_PINGS = { parse: ['users', 'roles'] };

const cooldowns = new Map();

function accentOf(row) {
  return row.accentColor && /^#[0-9a-f]{6}$/i.test(row.accentColor) ? parseInt(row.accentColor.slice(1), 16) : undefined;
}

function buildInteractivePayload(row) {
  return blocksMessage(row.blocks, { context: { messageId: row.id }, allowedMentions: MESSAGE_PINGS, color: accentOf(row) });
}

async function limitFor(guildId, key) {
  const premium = await isGuildPremium(guildId);
  return premium ? LIMITS.premium[key] : LIMITS.free[key];
}

async function publishInteractiveMessage(client, { guildId, id, channelId }) {
  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return { ok: false, error: 'not-found' };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: 'guild-missing' };

  const targetId = channelId || row.channelId;
  if (!targetId) return { ok: false, error: 'not-published' };

  const channel = guild.channels.cache.get(targetId);
  if (!channel || !channel.isTextBased()) return { ok: false, error: 'channel-missing' };

  const me = guild.members.me;
  if (me && !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    return { ok: false, error: 'missing-permission' };
  }

  const payload = buildInteractivePayload(row);
  const sameChannel = row.channelId === targetId && row.messageId;

  if (sameChannel) {
    const existing = await channel.messages.fetch(row.messageId).catch(() => null);
    if (existing) {
      const edited = await existing.edit(payload).then(() => true).catch(error => {
        console.error('Failed to edit interactive message:', error);
        return false;
      });
      return edited ? { ok: true, row } : { ok: false, error: 'edit-failed' };
    }
  }

  if (row.channelId && row.messageId) {
    const oldChannel = guild.channels.cache.get(row.channelId);
    const old = oldChannel ? await oldChannel.messages.fetch(row.messageId).catch(() => null) : null;
    if (old) await old.delete().catch(() => {});
  }

  const sent = await channel.send(payload);
  const updated = await prisma.interactiveMessage.update({ where: { id }, data: { channelId: targetId, messageId: sent.id } });
  return { ok: true, row: updated };
}

async function deleteInteractiveMessage(client, { guildId, id }) {
  const row = await prisma.interactiveMessage.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return { ok: false, error: 'not-found' };

  if (row.channelId && row.messageId) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild ? guild.channels.cache.get(row.channelId) : null;
    const message = channel ? await channel.messages.fetch(row.messageId).catch(() => null) : null;
    if (message) await message.delete().catch(() => {});
  }

  await prisma.interactiveMessage.delete({ where: { id } });
  return { ok: true };
}

function findComponent(blocks, componentId) {
  for (const block of blocks || []) {
    if (block.type === 'actions') {
      const button = (block.buttons || []).find(item => item.id === componentId);
      if (button) return { kind: 'button', component: button };
    } else if (block.type === 'select' && block.id === componentId) {
      return { kind: 'select', component: block };
    }
  }
  return null;
}

function roleProblem(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  if (!role) return 'that role no longer exists';
  if (role.managed || role.id === guild.id) return 'that role cannot be assigned';
  const me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return "I'm missing the Manage Roles permission";
  if (role.position >= me.roles.highest.position) return 'that role is above my highest role';
  if (DANGEROUS_PERMISSIONS.some(name => role.permissions.has(PermissionFlagsBits[name]))) {
    return 'that role has moderation permissions and cannot be given by buttons';
  }
  return null;
}

async function runActions({ interaction, member, actions, context }) {
  const guild = interaction.guild;
  const state = new Set(member.roles.cache.keys());
  const toAdd = new Set();
  const toRemove = new Set();
  const timers = new Map();
  const lines = [];
  const extra = [];

  function planAdd(roleId, durationMinutes) {
    const problem = roleProblem(guild, roleId);
    if (problem) {
      lines.push(`⚠️ Could not give <@&${roleId}>: ${problem}.`);
      return;
    }
    if (state.has(roleId)) {
      if (durationMinutes) timers.set(roleId, durationMinutes);
      lines.push(`You already have <@&${roleId}>.`);
      return;
    }
    state.add(roleId);
    toRemove.delete(roleId);
    toAdd.add(roleId);
    if (durationMinutes) timers.set(roleId, durationMinutes);
    lines.push(durationMinutes ? `✅ Added <@&${roleId}> for ${formatDuration(durationMinutes)}.` : `✅ Added <@&${roleId}>.`);
  }

  function planRemove(roleId, quiet) {
    const problem = roleProblem(guild, roleId);
    if (problem) {
      if (!quiet) lines.push(`⚠️ Could not remove <@&${roleId}>: ${problem}.`);
      return;
    }
    if (!state.has(roleId)) {
      if (!quiet) lines.push(`You don't have <@&${roleId}>.`);
      return;
    }
    state.delete(roleId);
    toAdd.delete(roleId);
    toRemove.add(roleId);
    timers.delete(roleId);
    lines.push(`✅ Removed <@&${roleId}>.`);
  }

  for (const action of actions) {
    switch (action.type) {
      case 'addRole':
        for (const roleId of rolesOf(action)) planAdd(roleId, action.durationMinutes);
        break;
      case 'removeRole':
        for (const roleId of rolesOf(action)) planRemove(roleId, false);
        break;
      case 'toggleRole':
        for (const roleId of rolesOf(action)) {
          if (state.has(roleId)) planRemove(roleId, false);
          else planAdd(roleId, action.durationMinutes);
        }
        break;
      case 'swapRole': {
        const giving = new Set(rolesOf(action));
        for (const roleId of action.removeRoleIds || []) {
          if (!giving.has(roleId)) planRemove(roleId, true);
        }
        for (const roleId of giving) planAdd(roleId, action.durationMinutes);
        break;
      }
      case 'reply':
        lines.push(renderPlaceholders(action.content, context));
        break;
      case 'dm': {
        const sent = await member
          .send(v2Message([renderPlaceholders(action.content, context)], { allowedMentions: NO_PINGS }))
          .then(() => true)
          .catch(() => false);
        if (!sent) lines.push('⚠️ I could not DM you. Check your privacy settings.');
        break;
      }
      case 'sendMessage': {
        const channel = action.channelId ? guild.channels.cache.get(action.channelId) : interaction.channel;
        if (!channel || !channel.isTextBased()) {
          lines.push('⚠️ A message could not be sent: the channel no longer exists.');
          break;
        }
        await channel
          .send(v2Message([renderPlaceholders(action.content, context)], { allowedMentions: MESSAGE_PINGS, footer: false }))
          .catch(() => lines.push(`⚠️ I could not send a message in <#${channel.id}>.`));
        break;
      }
      case 'showMessage': {
        const target = await prisma.interactiveMessage.findUnique({ where: { id: action.messageId } });
        if (target && target.guildId === guild.id) {
          extra.push(blocksContainer(target.blocks, { context: { messageId: target.id }, footer: false, color: accentOf(target) }));
        } else {
          lines.push('⚠️ The linked message no longer exists.');
        }
        break;
      }
      default:
        break;
    }
  }

  const addList = [...toAdd];
  const removeList = [...toRemove];
  try {
    if (addList.length) await member.roles.add(addList);
    if (removeList.length) await member.roles.remove(removeList);
  } catch (error) {
    console.error('Interactive role update failed:', error);
    lines.push('⚠️ Discord rejected the role change. Check my role position and permissions.');
    return { lines, extra, added: [], removed: [] };
  }

  for (const [roleId, minutes] of timers) {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    await prisma.tempRole
      .upsert({
        where: { guildId_userId_roleId: { guildId: guild.id, userId: member.id, roleId } },
        update: { expiresAt },
        create: { guildId: guild.id, userId: member.id, roleId, expiresAt }
      })
      .catch(() => {});
  }
  if (removeList.length) {
    await prisma.tempRole.deleteMany({ where: { guildId: guild.id, userId: member.id, roleId: { in: removeList } } }).catch(() => {});
  }

  return { lines, extra, added: addList, removed: removeList };
}

function formatDuration(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function summaryContainer(lines) {
  return blocksContainer(
    lines.map(line => ({ type: 'text', content: line })),
    { footer: false }
  );
}

async function logRoleChange({ guild, row, user, label, added, removed }) {
  if (!row.logChannelId || (!added.length && !removed.length)) return;
  const channel = guild.channels.cache.get(row.logChannelId);
  if (!channel || !channel.isTextBased()) return;

  const parts = [];
  if (added.length) parts.push(`+ ${added.map(id => `<@&${id}>`).join(' ')}`);
  if (removed.length) parts.push(`− ${removed.map(id => `<@&${id}>`).join(' ')}`);
  await channel
    .send(v2Message([`**${user.tag || user.username}** (<@${user.id}>) used **${label}** in *${row.name}*`, parts.join('   ')], { footer: false, allowedMentions: NO_PINGS }))
    .catch(() => {});
}

async function checkConditions({ interaction, member, component, messageId }) {
  const required = component.requiredRoleIds || [];
  if (required.length && !required.some(id => member.roles.cache.has(id))) {
    return `You need one of these roles to use this: ${required.map(id => `<@&${id}>`).join(', ')}`;
  }

  const blocked = component.blockedRoleIds || [];
  if (blocked.some(id => member.roles.cache.has(id))) {
    return "You can't use this right now because of one of your roles.";
  }

  if (component.requiredLevel > 0) {
    const levelRow = await prisma.memberLevel.findUnique({ where: { guildId_userId: { guildId: interaction.guild.id, userId: member.id } } });
    const level = levelRow ? levelFromXp(levelRow.xp).level : 0;
    if (level < component.requiredLevel) return `You need to be level **${component.requiredLevel}** to use this. You are level **${level}**.`;
  }

  if (component.cooldownSeconds > 0) {
    const key = `${member.id}:${messageId}:${component.id}`;
    const readyAt = cooldowns.get(key) || 0;
    const now = Date.now();
    if (readyAt > now) return `Slow down! Try again in ${Math.ceil((readyAt - now) / 1000)}s.`;
    cooldowns.set(key, now + component.cooldownSeconds * 1000);
  }

  return null;
}

async function handleInteractiveComponent(interaction) {
  const [, messageId, componentId] = interaction.customId.split(':');
  if (!interaction.guild || !interaction.member) return;

  const row = await prisma.interactiveMessage.findUnique({ where: { id: messageId } });
  const found = row ? findComponent(row.blocks, componentId) : null;
  if (!row || row.guildId !== interaction.guild.id || !found) {
    await interaction.reply(v2Message(['This button is no longer active.'], { ephemeral: true, footer: false }));
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member);
  const context = userContext(interaction.user, interaction.guild);

  const denial = await checkConditions({ interaction, member, component: { ...found.component, id: componentId }, messageId });
  if (denial) {
    await interaction.reply(v2Message([denial], { ephemeral: true, footer: false, allowedMentions: NO_PINGS }));
    return;
  }

  let actions = [];
  let label = '';
  if (found.kind === 'button') {
    actions = found.component.actions || [];
    label = found.component.label;
  } else {
    const chosen = new Set(interaction.values);
    const picked = found.component.options.filter(option => chosen.has(option.id));
    for (const option of picked) actions = actions.concat(option.actions || []);
    label = picked.map(option => option.label).join(', ');
  }

  if (!actions.length) {
    await interaction.reply(v2Message(['Nothing is set up for this yet.'], { ephemeral: true, footer: false }));
    return;
  }

  const { lines, extra, added, removed } = await runActions({ interaction, member, actions, context });

  const components = [];
  if (lines.length) components.push(summaryContainer(lines));
  components.push(...extra);
  if (!components.length) components.push(summaryContainer(['Done.']));

  await interaction.reply({
    components,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS
  });

  await logRoleChange({ guild: interaction.guild, row, user: interaction.user, label, added, removed });
}

async function sweepTempRoles(client) {
  const due = await prisma.tempRole.findMany({ where: { expiresAt: { lte: new Date() } }, take: 100 });

  for (const entry of due) {
    const guild = client.guilds.cache.get(entry.guildId);
    if (guild) {
      const member = await guild.members.fetch(entry.userId).catch(() => null);
      if (member && member.roles.cache.has(entry.roleId)) {
        await member.roles.remove(entry.roleId).catch(() => {});
      }
    }
    await prisma.tempRole.delete({ where: { id: entry.id } }).catch(() => {});
  }
}

function startTempRoleSweeper(client) {
  let running = false;
  setInterval(() => {
    const now = Date.now();
    for (const [key, readyAt] of cooldowns) {
      if (readyAt <= now) cooldowns.delete(key);
    }
    if (running) return;
    running = true;
    sweepTempRoles(client)
      .catch(error => console.error('Temporary role sweep failed:', error))
      .finally(() => {
        running = false;
      });
  }, 30 * 1000);
}

function emojiKey(emoji) {
  return emoji.id || emoji.name;
}

async function addReactionRole(client, { guildId, channelId, messageId, emoji, roleId, mode }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: 'guild-missing' };

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return { ok: false, error: 'channel-missing' };

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return { ok: false, error: 'message-missing' };

  const parsed = parseEmoji(emoji);
  if (!parsed || !parsed.name) return { ok: false, error: 'invalid-emoji' };

  const problem = roleProblem(guild, roleId);
  if (problem) return { ok: false, error: 'invalid-role', detail: problem };

  const existing = await prisma.reactionRole.count({ where: { guildId } });
  if (existing >= (await limitFor(guildId, 'reactionRoles'))) return { ok: false, error: 'limit-reached' };

  const key = parsed.id || parsed.name;
  const duplicate = await prisma.reactionRole.findUnique({ where: { messageId_emoji: { messageId, emoji: key } } });
  if (duplicate) return { ok: false, error: 'duplicate' };

  const reacted = await message.react(parsed.id ? `${parsed.name}:${parsed.id}` : parsed.name).then(() => true).catch(() => false);
  if (!reacted) return { ok: false, error: 'react-failed' };

  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const row = await prisma.reactionRole.create({
    data: { guildId, channelId, messageId, emoji: key, roleId, mode: ['once', 'unique'].includes(mode) ? mode : 'toggle' }
  });
  return { ok: true, row };
}

async function removeReactionRole(client, { guildId, id }) {
  const row = await prisma.reactionRole.findUnique({ where: { id } });
  if (!row || row.guildId !== guildId) return { ok: false, error: 'not-found' };

  const guild = client.guilds.cache.get(guildId);
  const channel = guild ? guild.channels.cache.get(row.channelId) : null;
  const message = channel ? await channel.messages.fetch(row.messageId).catch(() => null) : null;
  if (message) {
    const reaction = message.reactions.cache.find(item => emojiKey(item.emoji) === row.emoji);
    if (reaction) await reaction.users.remove(client.user.id).catch(() => {});
  }

  await prisma.reactionRole.delete({ where: { id } });
  return { ok: true };
}

async function handleReaction(reaction, user, added) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const message = reaction.message;
  if (!message.guildId) return;

  const row = await prisma.reactionRole.findUnique({
    where: { messageId_emoji: { messageId: message.id, emoji: emojiKey(reaction.emoji) } }
  });
  if (!row) return;

  const guild = reaction.client.guilds.cache.get(row.guildId);
  if (!guild) return;
  if (roleProblem(guild, row.roleId)) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (added) {
    if (row.mode === 'unique') {
      const siblings = await prisma.reactionRole.findMany({ where: { messageId: message.id, id: { not: row.id } } });
      const stale = siblings.filter(item => member.roles.cache.has(item.roleId) && !roleProblem(guild, item.roleId));
      if (stale.length) await member.roles.remove(stale.map(item => item.roleId)).catch(() => {});
      for (const item of siblings) {
        const other = message.reactions.cache.find(entry => emojiKey(entry.emoji) === item.emoji);
        if (other) await other.users.remove(user.id).catch(() => {});
      }
    }
    await member.roles.add(row.roleId).catch(() => {});
  } else if (row.mode !== 'once') {
    await member.roles.remove(row.roleId).catch(() => {});
  }
}

async function cleanupDeletedMessage(message) {
  if (!message.guildId) return;
  await prisma.reactionRole.deleteMany({ where: { messageId: message.id } }).catch(() => {});
  await prisma.interactiveMessage.updateMany({ where: { messageId: message.id }, data: { messageId: null, channelId: null } }).catch(() => {});
}

module.exports = {
  buildInteractivePayload,
  publishInteractiveMessage,
  deleteInteractiveMessage,
  handleInteractiveComponent,
  startTempRoleSweeper,
  addReactionRole,
  removeReactionRole,
  handleReaction,
  cleanupDeletedMessage
};
