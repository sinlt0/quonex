const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isDev } = require('../../../../lib/permissions');
const { PREMIUM_DURATIONS } = require('../../../../config/durations');
const prisma = require('../../../../lib/db');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'premiumadd',
  category: 'Premium',
  description: 'Grant premium to a server (dev only)',
  usage: 'premiumadd <serverid>',
  hidden: true,
  async execute(message, args) {
    if (!isDev(message.author.id)) {
      await message.reply(v2Message([`${em.error} You are not allowed to use this command.`, supportLine()]));
      return;
    }

    const guildId = args[0];
    if (!guildId) {
      await message.reply(v2Message([`${em.error} Usage: premiumadd <serverid>`]));
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`premium_add_select_${guildId}`)
      .setPlaceholder('Select a duration')
      .addOptions(PREMIUM_DURATIONS.map(duration => ({ label: duration.label, value: duration.id })));

    const row = new ActionRowBuilder().addComponents(select);
    const sent = await message.reply(v2Message([`Select a premium duration for server ${guildId}`], { extraComponents: [row] }));

    const collector = sent.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async selectInteraction => {
      if (selectInteraction.user.id !== message.author.id) return;

      const chosen = PREMIUM_DURATIONS.find(duration => duration.id === selectInteraction.values[0]);
      const expiresAt = chosen.ms === null ? null : new Date(Date.now() + chosen.ms);

      await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
      await prisma.premium.upsert({
        where: { guildId },
        update: { expiresAt, lifetime: chosen.ms === null, addedBy: message.author.id },
        create: { guildId, expiresAt, lifetime: chosen.ms === null, addedBy: message.author.id }
      });

      await selectInteraction.update(v2Message([`${em.success} Premium (${chosen.label}) granted to server ${guildId}`]));
    });
  }
};
