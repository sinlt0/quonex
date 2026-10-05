const { getTicketContext, isStaffMember, claimTicket } = require('../../../../lib/tickets');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  name: 'claim',
  category: 'Tickets',
  description: 'Claim this ticket',
  usage: 'claim',
  async execute(message) {
    if (!message.guild) return;

    const context = await getTicketContext(message.channel.id);
    if (!context) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-ticket-channel']}`]));
      return;
    }

    const { ticket, panel } = context;

    if (!isStaffMember(message.member, panel)) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`, supportLine()]));
      return;
    }

    const result = await claimTicket({ ticket, actorId: message.author.id });
    if (!result.ok) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
      return;
    }

    await message.reply(v2Message([`${em.success} Ticket claimed by <@${message.author.id}>.`]));
  }
};
