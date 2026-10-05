const { SlashCommandBuilder } = require('discord.js');
const {
  getTicketContext,
  isStaffMember,
  closeTicket,
  claimTicket,
  releaseTicket,
  addMember,
  removeMember,
  renameTicket
} = require('../../../../lib/tickets');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket in this channel')
    .addSubcommand(sub => sub.setName('close').setDescription('Close this ticket'))
    .addSubcommand(sub => sub.setName('claim').setDescription('Claim this ticket'))
    .addSubcommand(sub => sub.setName('release').setDescription('Release this ticket'))
    .addSubcommand(sub =>
      sub.setName('add').setDescription('Add a user to this ticket').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from this ticket')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('rename')
        .setDescription('Rename this ticket channel')
        .addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true))
    ),
  category: 'Tickets',
  usage: '/ticket <close|claim|release|add|remove|rename>',
  async execute(interaction) {
    const context = await getTicketContext(interaction.channel.id);
    if (!context) {
      await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-ticket-channel']}`], { ephemeral: true }));
      return;
    }

    const { ticket, panel } = context;
    const sub = interaction.options.getSubcommand();
    const isOpener = ticket.openerId === interaction.user.id;
    const staff = isStaffMember(interaction.member, panel);

    if (sub === 'close') {
      if (!staff && !isOpener) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`, supportLine()], { ephemeral: true }));
        return;
      }

      const result = await closeTicket({ ticket, channel: interaction.channel, closerId: interaction.user.id });
      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Closing ticket...`]));
      return;
    }

    if (!staff) {
      await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`, supportLine()], { ephemeral: true }));
      return;
    }

    if (sub === 'claim') {
      const result = await claimTicket({ ticket, actorId: interaction.user.id });
      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }
      await interaction.reply(v2Message([`${em.success} Ticket claimed by <@${interaction.user.id}>.`]));
    } else if (sub === 'release') {
      const result = await releaseTicket({ ticket });
      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }
      await interaction.reply(v2Message([`${em.success} Ticket released.`]));
    } else if (sub === 'add') {
      const target = interaction.options.getUser('user');
      await addMember({ channel: interaction.channel, userId: target.id });
      await interaction.reply(v2Message([`${em.success} ${target.tag} added to the ticket.`]));
    } else if (sub === 'remove') {
      const target = interaction.options.getUser('user');
      await removeMember({ channel: interaction.channel, userId: target.id });
      await interaction.reply(v2Message([`${em.success} ${target.tag} removed from the ticket.`]));
    } else if (sub === 'rename') {
      const name = interaction.options.getString('name');
      const result = await renameTicket({ channel: interaction.channel, name });
      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }
      await interaction.reply(v2Message([`${em.success} Ticket renamed to \`${result.name}\`.`]));
    }
  }
};
