const { handlePrefix } = require('../handlers/prefixHandler');
const { handleNoPrefix } = require('../handlers/noPrefixHandler');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    const usedPrefix = await handlePrefix(message);
    if (usedPrefix) return;

    await handleNoPrefix(message);
  }
};
