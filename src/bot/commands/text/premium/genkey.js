const crypto = require('crypto');
const { isDev } = require('../../../../lib/permissions');
const { PREMIUM_DURATIONS } = require('../../../../config/durations');
const prisma = require('../../../../lib/db');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'premiumkey',
  category: 'Premium',
  description: 'Generate a premium key (dev only)',
  usage: 'premiumkey <duration>',
  hidden: true,
  async execute(message, args) {
    if (!isDev(message.author.id)) {
      await message.reply(v2Message([`${em.error} You are not allowed to use this command.`, supportLine()]));
      return;
    }

    const durationId = args[0];
    const duration = PREMIUM_DURATIONS.find(item => item.id === durationId);
    if (!duration) {
      await message.reply(v2Message([`${em.error} Usage: premiumkey <${PREMIUM_DURATIONS.map(item => item.id).join('|')}>`]));
      return;
    }

    const key = crypto.randomBytes(12).toString('hex').toUpperCase();
    await prisma.premiumKey.create({ data: { key, duration: durationId, createdBy: message.author.id } });

    await message.reply(v2Message([`${em.key} Premium key generated: \`${key}\``]));
  }
};
