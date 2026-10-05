const prisma = require('./db');
const { DEFAULT_PREFIX } = require('../config/branding');

async function getPrefix(guildId) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  return guild && guild.prefix ? guild.prefix : DEFAULT_PREFIX;
}

async function setPrefix(guildId, prefix) {
  await prisma.guild.upsert({
    where: { id: guildId },
    update: { prefix },
    create: { id: guildId, prefix }
  });
}

async function resetPrefix(guildId) {
  await prisma.guild.upsert({
    where: { id: guildId },
    update: { prefix: null },
    create: { id: guildId }
  });
}

module.exports = { getPrefix, setPrefix, resetPrefix };
