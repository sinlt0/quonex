const { handleGuildMemberRemove } = require('../../lib/greet');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await handleGuildMemberRemove(member);
  }
};
