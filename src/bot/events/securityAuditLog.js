const { handleAuditEntry } = require('../../lib/security/antinuke');

module.exports = {
  name: 'guildAuditLogEntryCreate',
  async execute(entry, guild) {
    await handleAuditEntry(entry, guild);
  }
};
