const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
const CHANNEL_TYPE_VOICE = 2;
const CHANNEL_TYPE_STAGE = 13;

export async function getGuildChannels(guildId) {
  const response = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    next: { revalidate: 30 }
  });

  if (!response.ok) return { textChannels: [], categories: [], voiceChannels: [] };

  const channels = await response.json();
  return {
    textChannels: channels.filter(channel => channel.type === CHANNEL_TYPE_TEXT),
    categories: channels.filter(channel => channel.type === CHANNEL_TYPE_CATEGORY),
    voiceChannels: channels.filter(channel => channel.type === CHANNEL_TYPE_VOICE || channel.type === CHANNEL_TYPE_STAGE)
  };
}

export async function getGuildRoles(guildId) {
  const response = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    next: { revalidate: 30 }
  });

  if (!response.ok) return [];

  const roles = await response.json();
  return roles.filter(role => !role.managed && role.name !== '@everyone');
}
