const { handlePrefix } = require('../handlers/prefixHandler');
const { handleNoPrefix } = require('../handlers/noPrefixHandler');
const { handleAfkReturn, notifyAfkMentions } = require('../../lib/afk');
const { addXpFromMessage } = require('../../lib/levels');
const { handleMessage: handleAutomod } = require('../../lib/security/automod');
const { handleEveryoneMention } = require('../../lib/security/antinuke');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.guild) {
      const removed = await handleEveryoneMention(message).catch(error => {
        console.error('Everyone mention check failed:', error);
        return false;
      });
      if (removed) return;
      const deleted = await handleAutomod(message).catch(error => {
        console.error('Auto-mod check failed:', error);
        return false;
      });
      if (deleted) return;
    }

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
