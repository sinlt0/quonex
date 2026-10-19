import { prisma } from '../../../../lib/db';
import { getGuildChannels, getGuildRoles } from '../../../../lib/guildResources';
import { limitFor } from '../../../../lib/panelLimits';
import ModuleShell from '../../../../components/dash/ModuleShell';
import VoiceForm from './VoiceForm';

export default async function VoicePage({ params }) {
  const { guildId } = await params;

  const [settingsRow, lobbies, activeRooms, { textChannels, voiceChannels, categories }, roles, lobbyLimit] = await Promise.all([
    prisma.tempVoiceSettings.findUnique({ where: { guildId } }),
    prisma.tempVoiceLobby.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    prisma.tempVoiceChannel.count({ where: { guildId } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId),
    limitFor(guildId, 'voiceLobbies')
  ]);

  const settings = {
    logChannelId: settingsRow?.logChannelId ?? '',
    saveProfiles: settingsRow?.saveProfiles ?? true,
    autoTransfer: settingsRow?.autoTransfer ?? true,
    graceSeconds: settingsRow?.graceSeconds ?? 30,
    maxChannels: settingsRow?.maxChannels ?? 50,
    blockDuringRaid: settingsRow?.blockDuringRaid ?? true,
    allowInvites: settingsRow?.allowInvites ?? false,
    panelEnabled: settingsRow?.panelEnabled ?? true
  };

  const lobbyData = lobbies.map(lobby => ({
    id: lobby.id,
    channelId: lobby.channelId,
    categoryId: lobby.categoryId ?? '',
    nameTemplate: lobby.nameTemplate,
    userLimit: lobby.userLimit,
    bitrate: lobby.bitrate ? Math.round(lobby.bitrate / 1000) : 0,
    cooldownSeconds: lobby.cooldownSeconds,
    ownerManaged: lobby.ownerManaged,
    allowedRoleIds: lobby.allowedRoleIds,
    blockedRoleIds: lobby.blockedRoleIds
  }));

  return (
    <ModuleShell moduleId="voice" callout="Members join a lobby channel and get their own room with a control panel. Lobbies can also be created in Discord with /tempvoice setup.">
      <VoiceForm
        guildId={guildId}
        settings={settings}
        lobbies={lobbyData}
        activeRooms={activeRooms}
        lobbyLimit={lobbyLimit}
        textChannels={textChannels}
        voiceChannels={voiceChannels}
        categories={categories}
        roles={roles}
      />
    </ModuleShell>
  );
}
