const prisma = require('../db');

async function nextCaseNumber(guildId) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  const row = await prisma.modCounter.upsert({
    where: { guildId },
    update: { last: { increment: 1 } },
    create: { guildId, last: 1 }
  });
  return row.last;
}

async function createCase({ guildId, userId, moderatorId, action, reason, duration = null, auto = false, expiresAt = null }) {
  const caseNumber = await nextCaseNumber(guildId);
  return prisma.modCase.create({
    data: { guildId, caseNumber, userId, moderatorId, action, reason: reason ? String(reason).slice(0, 500) : null, duration, auto, expiresAt }
  });
}

function getCase(guildId, caseNumber) {
  return prisma.modCase.findUnique({ where: { guildId_caseNumber: { guildId, caseNumber } } });
}

function listCases(guildId, { userId, moderatorId, action, skip = 0, take = 10 } = {}) {
  const where = { guildId, ...(userId ? { userId } : {}), ...(moderatorId ? { moderatorId } : {}), ...(action ? { action } : {}) };
  return Promise.all([prisma.modCase.findMany({ where, orderBy: { caseNumber: 'desc' }, skip, take }), prisma.modCase.count({ where })]);
}

function activeWarns(guildId, userId) {
  return prisma.modCase.findMany({
    where: { guildId, userId, action: 'warn', active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { caseNumber: 'desc' }
  });
}

async function setReason(guildId, caseNumber, reason) {
  const result = await prisma.modCase.updateMany({ where: { guildId, caseNumber }, data: { reason: String(reason).slice(0, 500) } });
  return result.count > 0;
}

async function deactivateWarn(guildId, caseNumber) {
  const result = await prisma.modCase.updateMany({ where: { guildId, caseNumber, action: 'warn', active: true }, data: { active: false } });
  return result.count > 0;
}

async function clearWarns(guildId, userId) {
  const result = await prisma.modCase.updateMany({ where: { guildId, userId, action: 'warn', active: true }, data: { active: false } });
  return result.count;
}

async function deleteCase(guildId, caseNumber) {
  const result = await prisma.modCase.deleteMany({ where: { guildId, caseNumber } });
  return result.count > 0;
}

module.exports = { createCase, getCase, listCases, activeWarns, setReason, deactivateWarn, clearWarns, deleteCase };
