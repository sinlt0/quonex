const { handleGuildBanAdd } = require('../../lib/greet');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    await handleGuildBanAdd(ban);
  }
};
