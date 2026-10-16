const { v2Message } = require('../components');
const { loadConfig, writeLog } = require('./store');
const { em } = require('../emojis');

const ICONS = { info: `${em.shield}`, warning: `${em.error}`, critical: `${em.alert}` };

async function securityLog(guild, { module, action, severity = 'info', executorId = null, targetId = null, detail = null, lines = [] }) {
  await writeLog({ guildId: guild.id, module, action, severity, executorId, targetId, detail }).catch(error => {
    console.error('Failed to write security log:', error);
  });

  const config = (await loadConfig(guild.id)).core;
  const header = `${ICONS[severity] || ICONS.info} **${module}** · ${action}`;
  const body = [header, ...lines];
  if (executorId) body.push(`Executor: <@${executorId}> (\`${executorId}\`)`);
  if (targetId) body.push(`Target: <@${targetId}> (\`${targetId}\`)`);

  const pings = severity === 'critical' ? config.alertRoleIds : [];
  if (pings.length) body.push(pings.map(id => `<@&${id}>`).join(' '));

  if (config.logChannelId) {
    const channel = guild.channels.cache.get(config.logChannelId);
    if (channel && channel.isTextBased()) {
      await channel
        .send(v2Message(body, { footer: false, allowedMentions: { parse: [], roles: pings } }))
        .catch(error => console.error('Failed to post security log:', error.message));
    }
  }

  if (severity === 'critical' && config.alertOwner) {
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) {
      await owner
        .send(v2Message([`${ICONS.critical} Security alert in **${guild.name}**`, ...body.slice(1)], { footer: false, allowedMentions: { parse: [] } }))
        .catch(() => {});
    }
  }
}

module.exports = { securityLog };
