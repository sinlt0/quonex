const MANAGE_GUILD = 0x20;

const GUILD_CACHE_MS = 45 * 1000;
const guildCache = new Map();
const guildInflight = new Map();

async function fetchUserGuilds(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });

  if (response.status === 429) {
    const retry = Number(response.headers.get('retry-after')) || 1;
    await new Promise(resolve => setTimeout(resolve, Math.min(retry, 3) * 1000));
    return null;
  }
  if (!response.ok) return response.status === 401 ? [] : null;
  return response.json();
}

export async function getUserManageableGuilds(accessToken) {
  if (!accessToken) return [];

  const cached = guildCache.get(accessToken);
  if (cached && cached.expires > Date.now()) return cached.guilds;

  if (!guildInflight.has(accessToken)) {
    guildInflight.set(
      accessToken,
      fetchUserGuilds(accessToken).finally(() => guildInflight.delete(accessToken))
    );
  }

  const fetched = await guildInflight.get(accessToken);
  if (fetched === null) return cached ? cached.guilds : [];

  const guilds = fetched.filter(guild => guild.owner || (Number(guild.permissions) & MANAGE_GUILD) === MANAGE_GUILD);
  guildCache.set(accessToken, { guilds, expires: Date.now() + GUILD_CACHE_MS });
  if (guildCache.size > 500) guildCache.delete(guildCache.keys().next().value);
  return guilds;
}

export async function getBotGuildIds() {
  const response = await fetch('https://discord.com/api/users/@me/guilds?limit=200', {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    next: { revalidate: 60 }
  });

  if (!response.ok) return new Set();

  const guilds = await response.json();
  return new Set(guilds.map(guild => guild.id));
}

export async function getMutualGuilds(accessToken) {
  const [userGuilds, botGuildIds] = await Promise.all([getUserManageableGuilds(accessToken), getBotGuildIds()]);
  return userGuilds.filter(guild => botGuildIds.has(guild.id));
}

export async function getBotProfile() {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    next: { revalidate: 300 }
  });

  if (!response.ok) return null;

  const user = await response.json();
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

  return { username: user.username, avatarUrl };
}

export function guildIconUrl(guild) {
  if (!guild.icon) return null;
  const extension = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}`;
}
