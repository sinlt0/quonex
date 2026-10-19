const manager = require('../../../lib/tempvoice/manager');
const { summaryLines } = require('../../../lib/tempvoice/panel');
const { resolveTargetUser } = require('../../../lib/resolveUser');
const { v2Message } = require('../../../lib/components');
const { em } = require('../../../lib/emojis');

const USER_ACTIONS = new Set(['permit', 'reject', 'kick', 'trust', 'untrust', 'block', 'unblock', 'transfer']);
const ALIASES = { name: 'rename', rename: 'rename', delete: 'remove', unlock: 'lock', unhide: 'hide', show: 'hide' };

async function say(message, lines) {
  return message.reply(v2Message(lines, { footer: false, allowedMentions: { parse: [] } }));
}

module.exports = {
  name: 'voice',
  category: 'Voice',
  description: 'Manage your temporary voice room',
  usage: 'voice <name|limit|bitrate|lock|unlock|hide|unhide|permit|reject|kick|trust|untrust|block|unblock|transfer|claim|info|delete> [value]',
  async execute(message, args) {
    if (!message.guild) return;
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1);
    if (!sub) return say(message, [`${em.tvVoice} Usage: \`${this.usage}\``]);

    const room = await manager.currentRoom(message.guild, message.author.id);
    if (!room) return say(message, [`${em.error} Join one of your temporary rooms first.`]);

    if (sub === 'info') {
      const ctx = await manager.context(message.guild, room.id, message.author.id);
      return say(message, [`### ${em.tvInfo} ${room.name}`, ...summaryLines(room, ctx.temp.ownerId)]);
    }

    let action = ALIASES[sub] || sub;
    let arg;
    if (action === 'rename') arg = rest.join(' ');
    else if (action === 'limit' || action === 'bitrate') arg = rest[0];
    else if (sub === 'lock' || sub === 'unlock') arg = sub === 'lock';
    else if (sub === 'hide' || sub === 'unhide' || sub === 'show') arg = sub === 'hide';
    else if (USER_ACTIONS.has(action)) {
      const user = await resolveTargetUser(message, rest);
      if (!user) return say(message, [`${em.error} Mention a member or give their ID.`]);
      arg = user.id;
    } else if (action !== 'claim' && action !== 'remove') return say(message, [`${em.error} Unknown option. Usage: \`${this.usage}\``]);

    const result = await manager.run(message.guild, room.id, message.author.id, action, arg);
    return say(message, [result.ok ? `${em.success} ${result.text}` : `${em.error} ${result.error}`]);
  }
};
