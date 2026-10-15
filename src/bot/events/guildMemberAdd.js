const { handleGuildMemberAdd } = require('../../lib/greet');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    await handleGuildMemberAdd(member);
  }
};
