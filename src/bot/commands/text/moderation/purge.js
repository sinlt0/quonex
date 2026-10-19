const { PermissionFlagsBits } = require('discord.js');
const kit = require('../../../../lib/moderation/textKit');
const engine = require('../../../../lib/moderation/engine');
const cases = require('../../../../lib/moderation/cases');
const { formatDuration } = require('../../../../lib/moderation/duration');
const { em } = require('../../../../lib/emojis');

const { runPurge, FILTERS } = require('../../../../lib/moderation/purge');

module.exports = {
  name: 'purge',
  category: 'Moderation',
  description: 'Bulk delete messages',
  usage: 'purge <amount> [all|bots|humans|links|invites|attachments|embeds|@user|text]',
  async execute(message, args) {
    const config = await kit.gate(message, PermissionFlagsBits.ManageMessages);
    if (!config) return;
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 1) return kit.fail(message, `Usage: \`${this.usage}\``);

    let sub = 'all';
    let userId;
    let text;
    const filter = args.slice(1).join(' ');
    if (filter) {
      const mention = filter.match(/^<@!?(\d+)>$/) || filter.match(/^(\d{15,22})$/);
      if (mention) {
        sub = 'user';
        userId = mention[1];
      } else if (FILTERS[filter.toLowerCase()]) {
        sub = filter.toLowerCase();
      } else {
        sub = 'contains';
        text = filter;
      }
    }

    await message.delete().catch(() => {});
    const result = await runPurge({ guild: message.guild, channel: message.channel, moderatorId: message.author.id, config, sub, amount, userId, text });
    const lines = result.error ? [`${em.alert} ${result.error}`] : [result.deleted ? `${em.on} Deleted **${result.deleted}** message${result.deleted === 1 ? '' : 's'}.` : 'Nothing matched. Messages older than 14 days cannot be bulk deleted.'];
    const sent = await message.channel.send(require('../../../../lib/components').v2Message(lines, { footer: false })).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
  }
};
