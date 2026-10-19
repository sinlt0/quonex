const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const manager = require('./manager');
const { summaryLines } = require('./panel');
const { v2Message } = require('../components');
const { em } = require('../emojis');

const MULTI = new Set(['permit', 'reject', 'kick', 'trust', 'block', 'unblock', 'untrust']);

const PICK_TEXT = {
  permit: 'Choose who may join this room',
  reject: 'Choose who to reject',
  kick: 'Choose who to remove from the room',
  trust: 'Choose who to trust',
  block: 'Choose who to block',
  unblock: 'Choose who to unblock',
  untrust: 'Choose who to untrust',
  transfer: 'Choose the new owner'
};

function reply(interaction, lines, extra = {}) {
  const payload = v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] }, ...extra });
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
}

function modalFor(action, channel) {
  const configs = {
    rename: { title: 'Rename room', label: 'New name', value: channel.name, max: 100, style: TextInputStyle.Short },
    limit: { title: 'User limit', label: 'Limit (0 = no limit, max 99)', value: String(channel.userLimit), max: 2, style: TextInputStyle.Short },
    bitrate: { title: 'Bitrate', label: 'Bitrate in kbps', value: String(Math.round(channel.bitrate / 1000)), max: 3, style: TextInputStyle.Short }
  };
  const config = configs[action];
  return new ModalBuilder()
    .setCustomId(`tv:modal:${action}:${channel.id}`)
    .setTitle(config.title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('value').setLabel(config.label).setStyle(config.style).setRequired(true).setMaxLength(config.max).setValue(config.value.slice(0, config.max))
      )
    );
}

async function showInfo(interaction, channelId) {
  const ctx = await manager.context(interaction.guild, channelId, interaction.user.id);
  if (ctx.error) return reply(interaction, [`${em.error} ${ctx.error}`]);
  const lines = [`### ${em.tvInfo} ${ctx.channel.name}`, ...summaryLines(ctx.channel, ctx.temp.ownerId), `Created <t:${Math.floor(ctx.temp.createdAt.getTime() / 1000)}:R>`];
  return reply(interaction, lines);
}

async function handleButton(interaction) {
  const [, action, sub] = interaction.customId.split(':');
  const channel = interaction.channel;
  if (!channel || !interaction.guild) return;

  if (action === 'rename' || action === 'limit' || action === 'bitrate') {
    const ctx = await manager.context(interaction.guild, channel.id, interaction.user.id);
    if (ctx.error) return reply(interaction, [`${em.error} ${ctx.error}`]);
    if (!ctx.owner && !ctx.staff) return reply(interaction, [`${em.error} Only the room owner can do that.`]);
    return interaction.showModal(modalFor(action, channel));
  }

  if (action === 'pick') {
    const ctx = await manager.context(interaction.guild, channel.id, interaction.user.id);
    if (ctx.error) return reply(interaction, [`${em.error} ${ctx.error}`]);
    if (sub !== 'claim' && !ctx.owner && !ctx.staff) return reply(interaction, [`${em.error} Only the room owner can do that.`]);
    const menu = new UserSelectMenuBuilder().setCustomId(`tv:sel:${sub}:${channel.id}`).setPlaceholder(PICK_TEXT[sub]).setMinValues(1).setMaxValues(MULTI.has(sub) ? 5 : 1);
    return reply(interaction, [PICK_TEXT[sub]], { extraComponents: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (action === 'info') return showInfo(interaction, channel.id);

  if (action === 'delete') {
    const ctx = await manager.context(interaction.guild, channel.id, interaction.user.id);
    if (ctx.error) return reply(interaction, [`${em.error} ${ctx.error}`]);
    if (!ctx.owner && !ctx.staff) return reply(interaction, [`${em.error} Only the room owner can do that.`]);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tv:confirmdelete:${channel.id}`).setLabel('Delete room').setStyle(ButtonStyle.Danger));
    return reply(interaction, ['Delete this room for everyone?'], { extraComponents: [row] });
  }

  if (action === 'confirmdelete') {
    const result = await manager.run(interaction.guild, sub, interaction.user.id, 'remove');
    return interaction.update(v2Message([result.ok ? `${em.success} ${result.text}` : `${em.error} ${result.error}`], { footer: false })).catch(() => {});
  }

  if (action === 'lock' || action === 'hide' || action === 'claim') {
    await interaction.deferReply({ ephemeral: true });
    const result = await manager.run(interaction.guild, channel.id, interaction.user.id, action);
    return reply(interaction, [result.ok ? `${em.success} ${result.text}` : `${em.error} ${result.error}`]);
  }
}

async function handleSelect(interaction) {
  const [, , action, channelId] = interaction.customId.split(':');
  await interaction.deferUpdate();
  const lines = [];
  for (const userId of interaction.values) {
    const result = await manager.run(interaction.guild, channelId, interaction.user.id, action, userId);
    lines.push(result.ok ? `${em.success} ${result.text}` : `${em.error} ${result.error}`);
  }
  await interaction.editReply(v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } })).catch(() => {});
}

async function handleModal(interaction) {
  const [, , action, channelId] = interaction.customId.split(':');
  await interaction.deferReply({ ephemeral: true });
  const value = interaction.fields.getTextInputValue('value');
  const result = await manager.run(interaction.guild, channelId, interaction.user.id, action, value);
  return reply(interaction, [result.ok ? `${em.success} ${result.text}` : `${em.error} ${result.error}`]);
}

async function handleTempVoice(interaction) {
  if (!interaction.guild) return;
  if (interaction.isModalSubmit()) return handleModal(interaction);
  if (interaction.isUserSelectMenu()) return handleSelect(interaction);
  if (interaction.isButton()) return handleButton(interaction);
}

module.exports = { handleTempVoice, showInfo };
