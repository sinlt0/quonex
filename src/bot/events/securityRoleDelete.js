const { rememberRole } = require('../../lib/security/antinuke');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    rememberRole(role);
  }
};
