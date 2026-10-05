const { SUPPORT_SERVER } = require('../config/branding');

function supportLine() {
  return `Need help? Join the support server: ${SUPPORT_SERVER}`;
}

module.exports = { supportLine };
