const { cleanupDeletedMessage } = require('../../lib/interactive');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    await cleanupDeletedMessage(message);
  }
};
