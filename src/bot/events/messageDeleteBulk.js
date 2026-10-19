const { logBulk } = require('../../lib/moderation/msglog');

module.exports = {
  name: 'messageDeleteBulk',
  async execute(messages, channel) {
    await logBulk(messages, channel);
  }
};
