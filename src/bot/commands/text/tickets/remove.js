const { getTicketContext, isStaffMember, removeMember } = require('../../../../lib/tickets');
const { resolveTargetUser } = require('../../../../lib/resolveUser');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  name: 'remove',
  category: 'Tickets',
  description: 'Remove a user from this ticket',
  usage: 'remove @user',
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

    const target = await resolveTargetUser(message, args);
    if (!target) {
      await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['target-missing']}`]));
      return;
    }

    await removeMember({ channel: message.channel, userId: target.id });
    await message.reply(v2Message([`${em.success} ${target.tag} removed from the ticket.`]));
  }
};
