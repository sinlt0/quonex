const { handleMessage } = require('../../lib/security/automod');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    const message = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
    if (!message || !message.guild || message.author.bot) return;
    if (oldMessage.content === message.content) return;
    await handleMessage(message, true).catch(error => console.error('Auto-mod edit check failed:', error));
  }
};
