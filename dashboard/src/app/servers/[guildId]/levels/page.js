import { prisma } from '../../../../lib/db';
import { getGuildChannels, getGuildRoles } from '../../../../lib/guildResources';
import { limitFor, isGuildPremium } from '../../../../lib/panelLimits';
import { levelFromXp } from '../../../../lib/xpCurve';
import ModuleShell from '../../../../components/dash/ModuleShell';
import { updateLevelToggleAction } from './actions';
import LevelsForm from './LevelsForm';

export default async function LevelsPage({ params }) {
  const { guildId } = await params;

  const [settingsRow, { textChannels, voiceChannels }, roles, rewardLimit, multiplierLimit, isPremium, top] = await Promise.all([
    prisma.levelSettings.findUnique({ where: { guildId }, include: { roleRewards: { orderBy: { level: 'asc' } } } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId),
    limitFor(guildId, 'levelRoleRewards'),
    limitFor(guildId, 'xpMultipliers'),
    isGuildPremium(guildId),
    prisma.memberLevel.findMany({ where: { guildId }, orderBy: { xp: 'desc' }, take: 10 })
  ]);

  const settings = {
    enabled: settingsRow?.enabled ?? false,
    xpMin: settingsRow?.xpMin ?? 15,
    xpMax: settingsRow?.xpMax ?? 25,
    cooldownSeconds: settingsRow?.cooldownSeconds ?? 60,
    levelUpEnabled: settingsRow?.levelUpEnabled ?? true,
    levelUpChannelId: settingsRow?.levelUpChannelId ?? '',
    levelUpMessage: settingsRow?.levelUpMessage ?? '{user} just reached level **{level}**!',
    ignoredChannelIds: settingsRow?.ignoredChannelIds ?? [],
    noXpRoleIds: settingsRow?.noXpRoleIds ?? [],
    voiceXpEnabled: settingsRow?.voiceXpEnabled ?? false,
    voiceXpPerMinute: settingsRow?.voiceXpPerMinute ?? 10,
    voiceRequireOthers: settingsRow?.voiceRequireOthers ?? true,
    globalMultiplier: settingsRow?.globalMultiplier ?? 1,
    xpMultipliers: Array.isArray(settingsRow?.xpMultipliers) ? settingsRow.xpMultipliers : [],
    rankCardEnabled: settingsRow?.rankCardEnabled ?? true,
    rankCardAccent: settingsRow?.rankCardAccent ?? '#8b7cf6',
    rankCardBackground: settingsRow?.rankCardBackground ?? '',
    roleRewards: (settingsRow?.roleRewards ?? []).map(reward => ({ id: reward.id, level: reward.level, roleId: reward.roleId }))
  };

  const leaderboard = top.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    xp: entry.xp,
    level: levelFromXp(entry.xp).level,
    messages: entry.messages
  }));

  async function toggleEnabled(next) {
    'use server';
    return updateLevelToggleAction(guildId, 'enabled', next);
  }

  return (
    <ModuleShell
      moduleId="levels"
      toggle={{ checked: settings.enabled, onChange: toggleEnabled }}
      callout="Members earn random XP per message and check progress with /rank and /leaderboard in Discord."
    >
      <LevelsForm
        guildId={guildId}
        settings={settings}
        textChannels={textChannels}
        voiceChannels={voiceChannels}
        roles={roles}
        rewardLimit={rewardLimit}
        multiplierLimit={multiplierLimit}
        isPremium={isPremium}
        leaderboard={leaderboard}
      />
    </ModuleShell>
  );
}
