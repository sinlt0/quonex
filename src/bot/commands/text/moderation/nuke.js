const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkNuke, executeNuke } = require('../../../../lib/moderation/nuke');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'nuke',
  category: 'Moderation',
  description: 'Wipe this channel by cloning it and deleting the original',
  usage: 'nuke',
  async execute(message) {
    const config = await kit.gate(message, PermissionFlagsBits.ManageChannels);
    if (!config) return;
    const channel = message.channel;
    const blocked = await checkNuke({ guild: message.guild, channel, userId: message.author.id, config });
    if (blocked) return kit.fail(message, blocked);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mod-nuke-yes-${message.id}`).setLabel('Nuke').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`mod-nuke-no-${message.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    const prompt = await message.reply(v2Message([`${em.alert} This deletes **every message** in this channel and recreates it with the same settings and permissions. This cannot be undone.`], { footer: false, extraComponents: [row] }));

    let choice;
    try {
      choice = await prompt.awaitMessageComponent({ filter: i => i.user.id === message.author.id && i.customId.endsWith(message.id), time: 30000 });
    } catch {
      return prompt.edit(v2Message(['Nuke timed out.'], { footer: false })).catch(() => {});
    }
    if (choice.customId.startsWith('mod-nuke-no')) return choice.update(v2Message(['Cancelled.'], { footer: false }));
    await choice.update(v2Message(['Nuking...'], { footer: false }));
    const clone = await executeNuke({ guild: message.guild, channel, user: message.author });
    if (!clone) return prompt.edit(v2Message([`${em.alert} Discord refused. Nothing was changed.`], { footer: false })).catch(() => {});
  }
};
