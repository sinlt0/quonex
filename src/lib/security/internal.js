const prisma = require('../db');
const { loadConfig, addTimer } = require('./store');
const { startPanic, endPanic, isPanic } = require('./antinuke');
const { startRaid, endRaid, isRaid } = require('./antiraid');
const { lockServer, unlockServer } = require('./lockdown');
const { createBackup, restoreBackup } = require('./backup');
const { postPanel, applyWebResult } = require('./verification');
const { securityLog } = require('./alerts');

async function runSecurityAction(client, body) {
  const { guildId, action, by } = body;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: 'guild-missing' };
  const config = await loadConfig(guildId);

  switch (action) {
    case 'panic-start': {
      const minutes = Number.parseInt(body.minutes, 10) || config.antinuke.panicMinutes;
      const started = await startPanic(guild, `Started from the dashboard${by ? ` by ${by}` : ''}`, minutes);
      return started ? { ok: true } : { ok: false, error: 'already-active' };
    }
    case 'panic-end': {
      const count = await endPanic(guild, by);
      return { ok: true, count };
    }
    case 'lockdown-start': {
      const minutes = Number.parseInt(body.minutes, 10) || config.lockdown.defaultMinutes || 0;
      const count = await lockServer(guild, { reason: `Dashboard lockdown${by ? ` by ${by}` : ''}` });
      if (minutes) await addTimer({ guildId, kind: 'unlock-server', targetId: guildId, expiresAt: new Date(Date.now() + minutes * 60000) });
      await securityLog(guild, { module: 'lockdown', action: 'server locked from the dashboard', severity: 'critical', executorId: by || null, lines: [`${count} channels locked.`] });
      return { ok: true, count };
    }
    case 'lockdown-end': {
      const count = await unlockServer(guild, { reason: 'Dashboard unlock' });
      await prisma.securityTimer.deleteMany({ where: { guildId, kind: { in: ['unlock-server', 'unlock-channel'] } } });
      await securityLog(guild, { module: 'lockdown', action: 'lockdown ended from the dashboard', executorId: by || null, lines: [`${count} channels unlocked.`] });
      return { ok: true, count };
    }
    case 'raid-start': {
      if (isRaid(guildId)) return { ok: false, error: 'already-active' };
      await startRaid(guild, config.antiraid, []);
      return { ok: true };
    }
    case 'raid-end': {
      if (!isRaid(guildId)) return { ok: false, error: 'not-active' };
      await endRaid(guild, by);
      return { ok: true };
    }
    case 'backup-create': {
      const row = await createBackup(guild, { name: body.name || null, by: by || null });
      await securityLog(guild, { module: 'core', action: 'backup created from the dashboard', executorId: by || null, lines: [row.name] });
      return { ok: true, id: row.id };
    }
    case 'backup-restore': {
      const row = await prisma.securityBackup.findFirst({ where: { id: body.backupId, guildId } });
      if (!row) return { ok: false, error: 'backup-missing' };
      const summary = await restoreBackup(guild, row, { roles: body.roles !== false, channels: body.channels !== false });
      await securityLog(guild, { module: 'core', action: 'backup restored from the dashboard', severity: 'warning', executorId: by || null, lines: [row.name] });
      return { ok: true, summary };
    }
    case 'verification-panel': {
      const channel = guild.channels.cache.get(body.channelId);
      if (!channel || !channel.isTextBased()) return { ok: false, error: 'channel-missing' };
      const sent = await postPanel(guild, channel).catch(() => null);
      return sent ? { ok: true } : { ok: false, error: 'send-failed' };
    }
    case 'web-verify': {
      const result = await applyWebResult(guild, body);
      return result;
    }
    case 'state':
      return { ok: true, panic: isPanic(guildId), raid: isRaid(guildId) };
    default:
      return { ok: false, error: 'unknown-action' };
  }
}

module.exports = { runSecurityAction };
