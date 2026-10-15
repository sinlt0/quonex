const { startBotStatusHeartbeat } = require('../../lib/botStatus');
const { startInternalApi } = require('../../lib/internalApi');
const { startVoiceXp } = require('../../lib/levels');
const { startTempRoleSweeper } = require('../../lib/interactive');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    startBotStatusHeartbeat(client);
    startInternalApi(client);
    startVoiceXp(client);
    startTempRoleSweeper(client);
  }
};
