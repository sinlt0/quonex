const { handlePrefix } = require('../handlers/prefixHandler');
const { handleNoPrefix } = require('../handlers/noPrefixHandler');
const { handleAfkReturn, notifyAfkMentions } = require('../../lib/afk');
const { addXpFromMessage } = require('../../lib/levels');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.author.bot && message.guild) {
      await handleAfkReturn(message).catch(error => console.error('AFK return check failed:', error));
      await notifyAfkMentions(message).catch(error => console.error('AFK mention check failed:', error));
      await addXpFromMessage(message).catch(error => console.error('Level XP check failed:', error));
    }

    const usedPrefix = await handlePrefix(message);
    if (usedPrefix) return;

    await handleNoPrefix(message);
  }
};
