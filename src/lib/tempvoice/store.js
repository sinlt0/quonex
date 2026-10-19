const prisma = require('../db');

const SETTINGS_KEYS = ['logChannelId', 'saveProfiles', 'autoTransfer', 'graceSeconds', 'maxChannels', 'blockDuringRaid', 'allowInvites', 'panelEnabled'];

async function getSettings(guildId) {
  const existing = await prisma.tempVoiceSettings.findUnique({ where: { guildId } });
  if (existing) return existing;
  return prisma.tempVoiceSettings.upsert({ where: { guildId }, update: {}, create: { guildId } });
}

async function updateSettings(guildId, data) {
  await getSettings(guildId);
  return prisma.tempVoiceSettings.update({ where: { guildId }, data });
}

function getLobby(channelId) {
  return prisma.tempVoiceLobby.findUnique({ where: { channelId } });
}

function getLobbyById(id) {
  return prisma.tempVoiceLobby.findUnique({ where: { id } });
}

function listLobbies(guildId) {
  return prisma.tempVoiceLobby.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

async function createLobby(guildId, data) {
  await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
  return prisma.tempVoiceLobby.create({ data: { guildId, ...data } });
}

function updateLobby(id, data) {
  return prisma.tempVoiceLobby.update({ where: { id }, data });
}

async function removeLobby(id) {
  return prisma.tempVoiceLobby.delete({ where: { id } }).catch(() => null);
}

function getTemp(channelId) {
  return prisma.tempVoiceChannel.findUnique({ where: { channelId } });
}

function listTemps(guildId) {
  return prisma.tempVoiceChannel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
}

function ownedBy(guildId, ownerId) {
  return prisma.tempVoiceChannel.findFirst({ where: { guildId, ownerId } });
}

function saveTemp(data) {
  return prisma.tempVoiceChannel.create({ data });
}

function updateTemp(channelId, data) {
  return prisma.tempVoiceChannel.update({ where: { channelId }, data });
}

function removeTemp(channelId) {
  return prisma.tempVoiceChannel.deleteMany({ where: { channelId } });
}

function getProfile(guildId, userId) {
  return prisma.tempVoiceProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
}

function saveProfile(guildId, userId, data) {
  return prisma.tempVoiceProfile.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: data,
    create: { guildId, userId, ...data }
  });
}

function resetProfile(guildId, userId) {
  return prisma.tempVoiceProfile.deleteMany({ where: { guildId, userId } });
}

module.exports = {
  SETTINGS_KEYS,
  getSettings,
  updateSettings,
  getLobby,
  getLobbyById,
  listLobbies,
  createLobby,
  updateLobby,
  removeLobby,
  getTemp,
  listTemps,
  ownedBy,
  saveTemp,
  updateTemp,
  removeTemp,
  getProfile,
  saveProfile,
  resetProfile
};
