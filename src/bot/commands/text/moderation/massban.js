const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

const store = require('../../../../lib/security/store');

module.exports = {
  name: 'massban',
  category: 'Moderation',
  description: 'Ban several users by ID',
  usage: 'massban <id> <id> ... [reason]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.BanMembers);
    if (!config) return;
    if (config.massBanTrustedOnly && !(await store.isUserTrusted(message.guild, message.author.id, 'moderation'))) {
      return kit.fail(message, 'Mass ban is limited to trusted users (owner, extra owners and the moderation whitelist).');
    }
    const ids = [];
    let index = 0;
    while (index < args.length && /^(<@!?)?\d{15,22}>?$/.test(args[index])) {
      ids.push(args[index].replace(/\D/g, ''));
      index += 1;
    }
    const unique = [...new Set(ids)];
    if (!unique.length) return kit.fail(message, `Give at least one user ID. Usage: \`${this.usage}\``);
    if (unique.length > config.massBanMax) return kit.fail(message, `You can ban at most ${config.massBanMax} users at once.`);
    const text = kit.reasonText(config, args.slice(index), message);
    if (text.stop) return;

    let done = 0;
    const failed = [];
    for (const id of unique) {
      const res = await engine.banUser({ guild: message.guild, moderator: message.member, userId: id, reason: text.reason, silent: true });
      if (res.ok) done += 1;
      else failed.push(`\`${id}\` ${res.error}`);
    }
    return kit.reply(message, [`${em.on} Banned **${done}** of ${unique.length}.`, ...failed.slice(0, 10)]);
  }
};
