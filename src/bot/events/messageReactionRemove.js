const { handleReaction } = require('../../lib/interactive');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    await handleReaction(reaction, user, false).catch(error => console.error('Reaction role remove failed:', error));
  }
};
