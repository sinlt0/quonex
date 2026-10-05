const prisma = require('./db');

async function updateBotStatus(client) {
  const data = {
    guildCount: client.guilds.cache.size,
    ping: Math.max(0, Math.round(client.ws.ping)),
    uptimeSeconds: Math.floor((client.uptime || 0) / 1000)
  };

  await prisma.botStatus.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data }
  });
}

function startBotStatusHeartbeat(client, intervalMs = 30000) {
  updateBotStatus(client).catch(() => {});
  return setInterval(() => {
    updateBotStatus(client).catch(() => {});
  }, intervalMs);
}

module.exports = { updateBotStatus, startBotStatusHeartbeat };
