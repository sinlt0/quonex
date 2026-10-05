const { getTicketContext, isStaffMember, closeTicket } = require('../../../../lib/tickets');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  name: 'close',
  category: 'Tickets',
  description: 'Close this ticket',
  usage: 'close',
  async execute(message) {
    if (!message.guild) return;

    const context = await getTicketContext(message.channel.id);
    if (!context) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-ticket-channel']}`]));
      return;
    }

    const { ticket, panel } = context;
    const isOpener = ticket.openerId === message.author.id;
    const staff = isStaffMember(message.member, panel);

    if (!staff && !isOpener) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`, supportLine()]));
      return;
    }

    const result = await closeTicket({ ticket, channel: message.channel, closerId: message.author.id });
    if (!result.ok) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
      return;
    }

    await message.reply(v2Message([`${em.success} Closing ticket...`]));
  }
};
