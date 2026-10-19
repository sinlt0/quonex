const { SlashCommandBuilder } = require('discord.js');
const manager = require('../../../../lib/tempvoice/manager');
const store = require('../../../../lib/tempvoice/store');
const { buildPanel } = require('../../../../lib/tempvoice/panel');
const { showInfo } = require('../../../../lib/tempvoice/interactions');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

const USER_SUBS = {
  permit: 'Let someone join your room',
  reject: 'Stop someone joining and remove them',
  kick: 'Remove someone from your room',
  trust: 'Always let someone into your rooms',
  untrust: 'Remove someone from your trusted list',
  block: 'Block someone from all your rooms',
  unblock: 'Unblock someone',
  transfer: 'Give your room to someone inside it'
};

function build() {
  const builder = new SlashCommandBuilder().setName('voice').setDescription('Manage your temporary voice room').setDMPermission(false);
  builder.addSubcommand(s => s.setName('panel').setDescription('Post the control panel in your room'));
  builder.addSubcommand(s => s.setName('name').setDescription('Rename your room').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(100)));
  builder.addSubcommand(s => s.setName('limit').setDescription('Set the user limit').addIntegerOption(o => o.setName('users').setDescription('0 removes the limit').setRequired(true).setMinValue(0).setMaxValue(99)));
  builder.addSubcommand(s => s.setName('bitrate').setDescription('Set the bitrate').addIntegerOption(o => o.setName('kbps').setDescription('Bitrate in kbps').setRequired(true).setMinValue(8).setMaxValue(384)));
  builder.addSubcommand(s => s.setName('lock').setDescription('Lock the room'));
  builder.addSubcommand(s => s.setName('unlock').setDescription('Unlock the room'));
  builder.addSubcommand(s => s.setName('hide').setDescription('Hide the room'));
  builder.addSubcommand(s => s.setName('unhide').setDescription('Show the room again'));
  for (const [name, text] of Object.entries(USER_SUBS)) builder.addSubcommand(s => s.setName(name).setDescription(text).addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)));
  builder.addSubcommand(s => s.setName('claim').setDescription('Claim a room whose owner left'));
  builder.addSubcommand(s => s.setName('info').setDescription('Show room details'));
  builder.addSubcommand(s => s.setName('delete').setDescription('Delete your room'));
  builder.addSubcommand(s => s.setName('reset').setDescription('Forget your saved room settings'));
  return builder;
}

function out(interaction, ok, text) {
  return interaction.editReply(v2Message([`${ok ? em.success : em.error} ${text}`], { ephemeral: true, footer: false, allowedMentions: { parse: [] } }));
}

module.exports = {
  data: build(),
  category: 'Voice',
  usage: '/voice <panel|name|limit|bitrate|lock|unlock|hide|unhide|permit|reject|kick|trust|untrust|block|unblock|transfer|claim|info|delete|reset>',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      await store.resetProfile(guild.id, interaction.user.id);
      return out(interaction, true, 'Your saved room settings were reset.');
    }

    const room = await manager.currentRoom(guild, interaction.user.id);
    if (!room) return out(interaction, false, 'Join one of your temporary rooms first.');

    if (sub === 'info') return showInfo(interaction, room.id);

    if (sub === 'panel') {
      const ctx = await manager.context(guild, room.id, interaction.user.id);
      if (ctx.error) return out(interaction, false, ctx.error);
      if (!ctx.owner && !ctx.staff) return out(interaction, false, 'Only the room owner can do that.');
      const sent = await room.send(await buildPanel(room, { ownerId: ctx.temp.ownerId })).catch(() => null);
      if (!sent) return out(interaction, false, 'I could not post in this room chat.');
      await store.updateTemp(room.id, { panelMessageId: sent.id });
      return out(interaction, true, 'Panel posted.');
    }

    let action = sub;
    let arg;
    if (sub === 'name') {
      action = 'rename';
      arg = interaction.options.getString('name');
    } else if (sub === 'limit') arg = interaction.options.getInteger('users');
    else if (sub === 'bitrate') arg = interaction.options.getInteger('kbps');
    else if (sub === 'lock' || sub === 'unlock') {
      action = 'lock';
      arg = sub === 'lock';
    } else if (sub === 'hide' || sub === 'unhide') {
      action = 'hide';
      arg = sub === 'hide';
    } else if (sub === 'delete') action = 'remove';
    else if (USER_SUBS[sub]) arg = interaction.options.getUser('user').id;

    const result = await manager.run(guild, room.id, interaction.user.id, action, arg);
    return out(interaction, result.ok, result.ok ? result.text : result.error);
  }
};
