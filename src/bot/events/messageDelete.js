const { cleanupDeletedMessage } = require('../../lib/interactive');
const { logDelete } = require('../../lib/moderation/msglog');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    await cleanupDeletedMessage(message);
    await logDelete(message).catch(error => console.error('Message delete log failed:', error));
  }
};
