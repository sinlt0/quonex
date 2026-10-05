const { getTicketContext, isStaffMember, renameTicket } = require('../../../../lib/tickets');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  name: 'rename',
  category: 'Tickets',
  description: 'Rename this ticket channel',
  usage: 'rename <name>',
  async execute(message, args) {
    if (!message.guild) return;

    const context = await getTicketContext(message.channel.id);
    if (!context) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-ticket-channel']}`]));
      return;
    }

    const { panel } = context;

    if (!isStaffMember(message.member, panel)) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['not-staff']}`, supportLine()]));
      return;
    }

    const name = args.join(' ');
    if (!name) {
      await message.reply(v2Message([`${em.error} Usage: rename <name>`]));
      return;
    }

    const result = await renameTicket({ channel: message.channel, name });
    if (!result.ok) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
      return;
    }

    await message.reply(v2Message([`${em.success} Ticket renamed to \`${result.name}\`.`]));
  }
};
