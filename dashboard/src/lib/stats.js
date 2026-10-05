import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { prisma } from './db';
import { getAllCommands } from './commands';
import { formatUptime } from '../../../src/lib/uptime.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function getLiveGuildCount() {
  try {
    const guilds = await rest.get(Routes.userGuilds());
    return guilds.length;
  } catch {
    return null;
  }
}

async function getBotStatusRow() {
  try {
    return await prisma.botStatus.findUnique({ where: { id: 1 } });
  } catch {
    return null;
  }
}

export async function getSiteStats() {
  const [liveGuildCount, botStatus] = await Promise.all([getLiveGuildCount(), getBotStatusRow()]);

  const guildCount = liveGuildCount ?? botStatus?.guildCount ?? null;
  const ping = botStatus?.ping ?? null;
  const uptimeSeconds = botStatus?.uptimeSeconds ?? null;

  return {
    guildCount,
    totalCommands: getAllCommands().length,
    ping,
    uptime: uptimeSeconds !== null ? formatUptime(uptimeSeconds * 1000) : null
  };
}
