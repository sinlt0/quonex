const fs = require('fs');
const path = require('path');
const prisma = require('./db');

function loadDevs() {
  const devsPath = path.join(__dirname, '..', '..', 'devs.json');
  return JSON.parse(fs.readFileSync(devsPath, 'utf8'));
}

function isOwner(userId) {
  const devs = loadDevs();
  return devs.owners.includes(userId);
}

function isDev(userId) {
  const devs = loadDevs();
  return devs.owners.includes(userId) || devs.devs.includes(userId);
}

function listOwners() {
  return loadDevs().owners;
}

function listDevs() {
  return loadDevs().devs;
}

async function isGuildPremium(guildId) {
  const premium = await prisma.premium.findUnique({ where: { guildId } });
  if (!premium) return false;
  if (premium.lifetime) return true;
  return Boolean(premium.expiresAt) && premium.expiresAt > new Date();
}

async function canUseNoPrefix(userId, guildId) {
  const globalEntry = await prisma.globalNoPrefix.findUnique({ where: { userId } });
  if (globalEntry) return true;

  const guildNp = await prisma.guildNoPrefix.findUnique({
    where: { guildId },
    include: { users: true }
  });
  if (!guildNp) return false;

  const premium = await isGuildPremium(guildId);
  if (!premium) return false;

  if (guildNp.mode === 'all') return true;
  return guildNp.users.some(entry => entry.userId === userId);
}

module.exports = { isOwner, isDev, listOwners, listDevs, isGuildPremium, canUseNoPrefix };
