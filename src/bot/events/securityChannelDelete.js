const { rememberChannel } = require('../../lib/security/antinuke');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    rememberChannel(channel);
  }
};
