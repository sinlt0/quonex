const { PermissionFlagsBits } = require('discord.js');
const { getPrefix, setPrefix, resetPrefix } = require('../../../../lib/prefix');
const { em } = require('../../../../lib/emojis');
const { v2Message } = require('../../../../lib/components');

module.exports = {
  name: 'prefix',
  category: 'Config',
  description: 'View or change the command prefix for this server',
  usage: 'prefix [set <prefix> | reset]',
  async execute(message, args) {
    if (!message.guild) return;
    const action = (args[0] || '').toLowerCase();

    if (!action || action === 'view') {
      const prefix = await getPrefix(message.guild.id);
      await message.reply(v2Message([`${em.arrow} Current prefix: \`${prefix}\``]));
      return;
    }

    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply(v2Message([`${em.error} You need the Manage Server permission to change the prefix.`]));
      return;
    }

    if (action === 'reset') {
      await resetPrefix(message.guild.id);
      await message.reply(v2Message([`${em.success} Prefix reset to default.`]));
      return;
    }

    if (action === 'set' && args[1]) {
      if (args[1].length > 5) {
        await message.reply(v2Message([`${em.error} Prefix must be 5 characters or fewer.`]));
        return;
      }
      await setPrefix(message.guild.id, args[1]);
      await message.reply(v2Message([`${em.success} Prefix set to \`${args[1]}\``]));
      return;
    }

    await message.reply(v2Message([`${em.error} Usage: \`${await getPrefix(message.guild.id)}${this.usage}\``]));
  }
};
