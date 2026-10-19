const { handleVoiceState } = require('../../lib/tempvoice/manager');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    await handleVoiceState(oldState, newState);
  }
};
