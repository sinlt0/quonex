const MANAGE_GUILD = 0x20;

export async function getUserManageableGuilds(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });

  if (!response.ok) return [];

  const guilds = await response.json();
  return guilds.filter(guild => guild.owner || (Number(guild.permissions) & MANAGE_GUILD) === MANAGE_GUILD);
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
