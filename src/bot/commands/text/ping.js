const { em } = require('../../../lib/emojis');
const { v2Message } = require('../../../lib/components');
const { formatUptime } = require('../../../lib/uptime');

module.exports = {
  name: 'ping',
  category: 'Info',
  description: 'Show bot latency and uptime',
  usage: 'ping',
  async execute(message) {
    const uptime = formatUptime(message.client.uptime || 0);
    await message.reply(v2Message([
      `$Pong! \`${message.client.ws.ping}ms\``,
      `${em.arrow} Uptime: \`${uptime}\``
    ]));
  }
};
