const { isDev } = require('../../../../lib/permissions');
const prisma = require('../../../../lib/db');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'npglobal',
  category: 'No-Prefix',
  description: 'Manage global no-prefix access (dev only)',
  usage: 'npglobal <add|remove> @user',
  hidden: true,
  async execute(message, args) {
    if (!isDev(message.author.id)) {
      await message.reply(v2Message([`${em.error} You are not allowed to use this command.`, supportLine()]));
      return;
    }

    const sub = args[0];
    const target = message.mentions.users.first();

    if (!target || !['add', 'remove'].includes(sub)) {
      await message.reply(v2Message([`${em.error} Usage: npglobal <add|remove> @user`]));
      return;
    }

    if (sub === 'add') {
      await prisma.globalNoPrefix.upsert({
        where: { userId: target.id },
        update: {},
        create: { userId: target.id, addedBy: message.author.id }
      });
      await message.reply(v2Message([`${em.success} ${target.tag} can now use no-prefix commands globally.`]));
    } else {
      await prisma.globalNoPrefix.deleteMany({ where: { userId: target.id } });
      await message.reply(v2Message([`${em.success} ${target.tag} no longer has global no-prefix access.`]));
    }
  }
};
