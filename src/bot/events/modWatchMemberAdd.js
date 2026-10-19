const { checkJoin } = require('../../lib/moderation/watch');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    await checkJoin(member);
  }
};
