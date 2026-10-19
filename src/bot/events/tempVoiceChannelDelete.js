const { onChannelDelete } = require('../../lib/tempvoice/manager');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    await onChannelDelete(channel);
  }
};
