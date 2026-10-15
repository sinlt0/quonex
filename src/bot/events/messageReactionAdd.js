const { handleReaction } = require('../../lib/interactive');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    await handleReaction(reaction, user, true).catch(error => console.error('Reaction role add failed:', error));
  }
};
