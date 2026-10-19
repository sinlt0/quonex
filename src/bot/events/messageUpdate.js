const { handleMessage } = require('../../lib/security/automod');
const { logEdit } = require('../../lib/moderation/msglog');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    const message = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
    if (!message || !message.guild || message.author.bot) return;
    if (oldMessage.content === message.content) return;
    await logEdit(oldMessage, message).catch(error => console.error('Message edit log failed:', error));
    await handleMessage(message, true).catch(error => console.error('Auto-mod edit check failed:', error));
  }
};
