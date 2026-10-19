const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const store = require('../../../../lib/tempvoice/store');
const manager = require('../../../../lib/tempvoice/manager');
const { LIMITS } = require('../../../../config/limits');
const { isGuildPremium } = require('../../../../lib/permissions');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');


function build() {
  return new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Set up join-to-create voice lobbies')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand(s =>
      s
        .setName('setup')
        .setDescription('Create a new join-to-create lobby')
        .addChannelOption(o => o.setName('channel').setDescription('Existing voice channel to use (default: create one)').addChannelTypes(ChannelType.GuildVoice))
        .addChannelOption(o => o.setName('category').setDescription('Category for the rooms').addChannelTypes(ChannelType.GuildCategory))
        .addStringOption(o => o.setName('name').setDescription('Room name template: {username} {display} {tag} {count} {game}').setMaxLength(100))
        .addIntegerOption(o => o.setName('limit').setDescription('Default user limit').setMinValue(0).setMaxValue(99))
    )
    .addSubcommand(s =>
      s
        .setName('edit')
        .setDescription('Edit a lobby')
        .addChannelOption(o => o.setName('lobby').setDescription('Lobby channel').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
        .addStringOption(o => o.setName('name').setDescription('Room name template').setMaxLength(100))
        .addIntegerOption(o => o.setName('limit').setDescription('Default user limit').setMinValue(0).setMaxValue(99))
        .addIntegerOption(o => o.setName('bitrate').setDescription('Default bitrate in kbps (0 = server default)').setMinValue(0).setMaxValue(384))
        .addIntegerOption(o => o.setName('cooldown').setDescription('Seconds between creations per user').setMinValue(0).setMaxValue(3600))
        .addChannelOption(o => o.setName('category').setDescription('Category for the rooms').addChannelTypes(ChannelType.GuildCategory))
        .addBooleanOption(o => o.setName('owner-managed').setDescription('Off makes rooms public with no owner controls'))
        .addRoleOption(o => o.setName('allow-role').setDescription('Toggle a role that may create rooms (none = everyone)'))
        .addRoleOption(o => o.setName('block-role').setDescription('Toggle a role that may not create rooms'))
    )
    .addSubcommand(s => s.setName('remove').setDescription('Stop using a channel as a lobby').addChannelOption(o => o.setName('lobby').setDescription('Lobby channel').setRequired(true).addChannelTypes(ChannelType.GuildVoice)))
    .addSubcommand(s => s.setName('list').setDescription('Show lobbies, settings and active rooms'))
    .addSubcommand(s =>
      s
        .setName('settings')
        .setDescription('Change server-wide temp voice settings')
        .addChannelOption(o => o.setName('log-channel').setDescription('Where to log room activity').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addBooleanOption(o => o.setName('save-profiles').setDescription('Remember each owner\'s name, limit, locks and trusted list'))
        .addBooleanOption(o => o.setName('auto-transfer').setDescription('Hand the room to someone when the owner leaves'))
        .addIntegerOption(o => o.setName('grace-seconds').setDescription('Wait before handing over ownership').setMinValue(0).setMaxValue(600))
        .addIntegerOption(o => o.setName('max-rooms').setDescription('Most temporary rooms at once').setMinValue(1).setMaxValue(200))
        .addBooleanOption(o => o.setName('block-during-raid').setDescription('Pause room creation during raid mode and panic'))
        .addBooleanOption(o => o.setName('allow-invites').setDescription('Allow invite links in room names'))
        .addBooleanOption(o => o.setName('panel').setDescription('Post the control panel in new rooms'))
    )
    .addSubcommand(s => s.setName('close').setDescription('Delete a temporary room').addChannelOption(o => o.setName('room').setDescription('Temporary room').setRequired(true).addChannelTypes(ChannelType.GuildVoice)));
}

function reply(interaction, lines) {
  return interaction.editReply(v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
}

function toggle(list, id) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}

async function setup(interaction) {
  const guild = interaction.guild;
  const lobbies = await store.listLobbies(guild.id);
  const premium = await isGuildPremium(guild.id);
  const limit = premium ? LIMITS.premium.voiceLobbies : LIMITS.free.voiceLobbies;
  if (lobbies.length >= limit) return reply(interaction, [`${em.error} You reached the limit of ${limit} lobbies${premium ? '' : '. Premium raises it'}.`]);

  let channel = interaction.options.getChannel('channel');
  const category = interaction.options.getChannel('category');
  if (channel && (await store.getLobby(channel.id))) return reply(interaction, [`${em.error} That channel is already a lobby.`]);
  if (channel && (await store.getTemp(channel.id))) return reply(interaction, [`${em.error} That channel is a temporary room.`]);

  if (!channel) {
    channel = await guild.channels
      .create({ name: 'Join to Create', type: ChannelType.GuildVoice, parent: category ? category.id : undefined, userLimit: 1, reason: `Temp voice lobby by ${interaction.user.tag}` })
      .catch(() => null);
    if (!channel) return reply(interaction, [`${em.error} I could not create the channel. Check my Manage Channels permission.`]);
  }

  await store.createLobby(guild.id, {
    channelId: channel.id,
    categoryId: category ? category.id : null,
    nameTemplate: interaction.options.getString('name') || "{username}'s room",
    userLimit: interaction.options.getInteger('limit') ?? 0
  });
  return reply(interaction, [`${em.success} Lobby ready: <#${channel.id}>. Members who join it get their own room.`]);
}

async function edit(interaction) {
  const channel = interaction.options.getChannel('lobby');
  const lobby = await store.getLobby(channel.id);
  if (!lobby) return reply(interaction, [`${em.error} That channel is not a lobby.`]);

  const data = {};
  const name = interaction.options.getString('name');
  const limit = interaction.options.getInteger('limit');
  const bitrate = interaction.options.getInteger('bitrate');
  const cooldown = interaction.options.getInteger('cooldown');
  const category = interaction.options.getChannel('category');
  const managed = interaction.options.getBoolean('owner-managed');
  const allow = interaction.options.getRole('allow-role');
  const block = interaction.options.getRole('block-role');
  if (name) data.nameTemplate = name;
  if (limit !== null) data.userLimit = limit;
  if (bitrate !== null) data.bitrate = bitrate ? bitrate * 1000 : null;
  if (cooldown !== null) data.cooldownSeconds = cooldown;
  if (category) data.categoryId = category.id;
  if (managed !== null) data.ownerManaged = managed;
  if (allow) data.allowedRoleIds = toggle(lobby.allowedRoleIds, allow.id).slice(0, 10);
  if (block) data.blockedRoleIds = toggle(lobby.blockedRoleIds, block.id).slice(0, 10);
  if (!Object.keys(data).length) return reply(interaction, ['Nothing to change.']);
  await store.updateLobby(lobby.id, data);
  return reply(interaction, [`${em.success} Lobby updated. New rooms use the new settings.`]);
}

async function list(interaction) {
  const guild = interaction.guild;
  const [lobbies, settings, temps] = await Promise.all([store.listLobbies(guild.id), store.getSettings(guild.id), store.listTemps(guild.id)]);
  const lines = [`### ${em.tvVoice} Temp voice`, `${em.tvUsers} ${temps.length}/${settings.maxChannels} active rooms`];
  lines.push(`Log: ${settings.logChannelId ? `<#${settings.logChannelId}>` : 'off'} · Profiles: ${settings.saveProfiles ? 'on' : 'off'} · Auto transfer: ${settings.autoTransfer ? `${settings.graceSeconds}s` : 'off'} · Raid pause: ${settings.blockDuringRaid ? 'on' : 'off'}`);
  if (!lobbies.length) lines.push('No lobbies yet. Use `/tempvoice setup`.');
  for (const lobby of lobbies) {
    const roles = [lobby.allowedRoleIds.length ? `allow ${lobby.allowedRoleIds.map(id => `<@&${id}>`).join(' ')}` : null, lobby.blockedRoleIds.length ? `block ${lobby.blockedRoleIds.map(id => `<@&${id}>`).join(' ')}` : null].filter(Boolean).join(' · ');
    lines.push(`<#${lobby.channelId}> · \`${lobby.nameTemplate}\` · limit ${lobby.userLimit || 'none'} · cooldown ${lobby.cooldownSeconds}s${lobby.ownerManaged ? '' : ' · public'}${roles ? ` · ${roles}` : ''}`);
  }
  return reply(interaction, lines);
}

async function settingsCommand(interaction) {
  const o = interaction.options;
  const data = {};
  const log = o.getChannel('log-channel');
  if (log) data.logChannelId = log.id;
  const map = { 'save-profiles': 'saveProfiles', 'auto-transfer': 'autoTransfer', 'block-during-raid': 'blockDuringRaid', 'allow-invites': 'allowInvites', panel: 'panelEnabled' };
  for (const [option, key] of Object.entries(map)) {
    const value = o.getBoolean(option);
    if (value !== null) data[key] = value;
  }
  const grace = o.getInteger('grace-seconds');
  if (grace !== null) data.graceSeconds = grace;
  const max = o.getInteger('max-rooms');
  if (max !== null) data.maxChannels = max;
  if (!Object.keys(data).length) return list(interaction);
  await store.updateSettings(interaction.guild.id, data);
  return reply(interaction, [`${em.success} Settings saved.`]);
}

module.exports = {
  data: build(),
  category: 'Voice',
  usage: '/tempvoice <setup|edit|remove|list|settings|close>',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') return setup(interaction);
    if (sub === 'edit') return edit(interaction);
    if (sub === 'list') return list(interaction);
    if (sub === 'settings') return settingsCommand(interaction);
    if (sub === 'remove') {
      const lobby = await store.getLobby(interaction.options.getChannel('lobby').id);
      if (!lobby) return reply(interaction, [`${em.error} That channel is not a lobby.`]);
      await store.removeLobby(lobby.id);
      return reply(interaction, [`${em.success} Lobby removed. The channel itself was left alone and existing rooms keep working.`]);
    }
    const room = interaction.options.getChannel('room');
    const temp = await store.getTemp(room.id);
    if (!temp) return reply(interaction, [`${em.error} That is not a temporary room.`]);
    await manager.removeChannel(interaction.guild, room.id, `Closed by ${interaction.user.tag}`);
    return reply(interaction, [`${em.success} Room deleted.`]);
  }
};
