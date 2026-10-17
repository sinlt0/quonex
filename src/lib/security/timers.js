const prisma = require('../db');
const { endPanic } = require('./antinuke');
const { endRaid } = require('./antiraid');
const { unlockChannel, unlockServer } = require('./lockdown');
const { handleVerifyTimeout } = require('./verification');
const { runAutoBackups } = require('./backup');
const { securityLog } = require('./alerts');

async function runTimer(client, timer) {
  const guild = client.guilds.cache.get(timer.guildId);
  if (!guild) return;

  switch (timer.kind) {
    case 'panic-end':
      await endPanic(guild);
      break;
    case 'raid-end':
      await endRaid(guild);
      break;
    case 'unlock-server':
      await unlockServer(guild, { reason: 'Lockdown timer ended' });
      await securityLog(guild, { module: 'lockdown', action: 'server lockdown ended automatically' });
      break;
    case 'unlock-channel': {
      const channel = guild.channels.cache.get(timer.targetId);
      if (channel) await unlockChannel(channel, { reason: 'Lockdown timer ended' });
      break;
    }
    case 'verify-timeout':
      await handleVerifyTimeout(guild, timer.targetId);
      break;
    case 'unban':
      await guild.members.unban(timer.targetId, 'Quonex: timed ban ended').catch(() => {});
      break;
    default:
      break;
  }
}

async function sweepTimers(client) {
  const due = await prisma.securityTimer.findMany({ where: { expiresAt: { lte: new Date() } }, take: 50 });
  for (const timer of due) {
    await prisma.securityTimer.delete({ where: { id: timer.id } }).catch(() => {});
    await runTimer(client, timer).catch(error => console.error(`Security timer ${timer.kind} failed:`, error));
  }
}

async function pruneLogs() {
  const rows = await prisma.securitySettings.findMany({ select: { guildId: true, config: true } });
  for (const row of rows) {
    const days = row.config && row.config.core && row.config.core.logRetentionDays ? row.config.core.logRetentionDays : 30;
    await prisma.securityLog.deleteMany({ where: { guildId: row.guildId, createdAt: { lt: new Date(Date.now() - days * 86400000) } } });
  }
  await prisma.securityLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 365 * 86400000) } } });
  await prisma.webVerifySession.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  for (const row of rows) {
    const days = row.config && row.config.verification && row.config.verification.webRetentionDays ? row.config.verification.webRetentionDays : 90;
    await prisma.verifiedIdentity.deleteMany({ where: { guildId: row.guildId, updatedAt: { lt: new Date(Date.now() - days * 86400000) } } });
  }
}

function startSecuritySweeper(client) {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    sweepTimers(client)
      .catch(error => console.error('Security sweep failed:', error))
      .finally(() => {
        running = false;
      });
  }, 15 * 1000);

  setInterval(() => {
    runAutoBackups(client).catch(error => console.error('Auto backup sweep failed:', error));
    pruneLogs().catch(error => console.error('Security log prune failed:', error));
  }, 60 * 60 * 1000);
}

module.exports = { startSecuritySweeper };
