const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { begin, fail } = require('../../../../lib/moderation/common');
const { checkNuke, executeNuke, TYPES } = require('../../../../lib/moderation/nuke');
const { v2Message } = require('../../../../lib/components');
const { em } = require('../../../../lib/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Wipe a channel by cloning it and deleting the original')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(...TYPES)),
  category: 'Moderation',
  usage: '/nuke [channel]',
  async execute(interaction) {
    const config = await begin(interaction);
    const guild = interaction.guild;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const blocked = await checkNuke({ guild, channel, userId: interaction.user.id, config });
    if (blocked) return fail(interaction, blocked);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mod-nuke-yes-${interaction.id}`).setLabel('Nuke').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`mod-nuke-no-${interaction.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    const prompt = await interaction.editReply(
      v2Message([`${em.alert} This deletes **every message** in <#${channel.id}> and recreates it with the same settings and permissions. This cannot be undone.`], { footer: false, extraComponents: [row] })
    );

    let choice;
    try {
      choice = await prompt.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id && i.customId.endsWith(interaction.id), time: 30000 });
    } catch {
      return interaction.editReply(v2Message(['Nuke timed out.'], { footer: false })).catch(() => {});
    }
    if (choice.customId.startsWith('mod-nuke-no')) return choice.update(v2Message(['Cancelled.'], { footer: false }));
    await choice.update(v2Message(['Nuking...'], { footer: false }));

    const clone = await executeNuke({ guild, channel, user: interaction.user });
    if (!clone) return interaction.editReply(v2Message([`${em.alert} Discord refused. Nothing was changed.`], { footer: false })).catch(() => {});
    return interaction.editReply(v2Message([`${em.on} Done. New channel: <#${clone.id}>`], { footer: false })).catch(() => {});
  }
};
