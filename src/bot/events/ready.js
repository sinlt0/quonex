const { startBotStatusHeartbeat } = require('../../lib/botStatus');
const { startInternalApi } = require('../../lib/internalApi');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    startBotStatusHeartbeat(client);
    startInternalApi(client);
  }
};
