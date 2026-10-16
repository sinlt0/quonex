const { handleJoin: antiraidJoin } = require('../../lib/security/antiraid');
const { handleJoin: verificationJoin } = require('../../lib/security/verification');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    await antiraidJoin(member).catch(error => console.error('Anti-raid join check failed:', error));
    await verificationJoin(member).catch(error => console.error('Verification join check failed:', error));
  }
};
