import { prisma } from '../../../../lib/db';
import { getGuildChannels } from '../../../../lib/guildResources';
import { isGuildPremium } from '../../../../lib/panelLimits';
import { DEFAULT_BLOCKS } from '../../../../lib/greetBlocks';
import ModuleShell from '../../../../components/dash/ModuleShell';
import GreetBuilderForm from './GreetBuilderForm';

export default async function GreetPage({ params }) {
  const { guildId } = await params;

  const [settings, { textChannels }, isPremium] = await Promise.all([
    prisma.greetSettings.findUnique({ where: { guildId } }),
    getGuildChannels(guildId),
    isGuildPremium(guildId)
  ]);

  const merged = {
    joinEnabled: settings?.joinEnabled ?? false,
    joinChannelId: settings?.joinChannelId ?? '',
    joinBlocks: settings?.joinBlocks ?? DEFAULT_BLOCKS.joinBlocks,
    joinCardEnabled: settings?.joinCardEnabled ?? false,
    joinCardBackground: settings?.joinCardBackground ?? '',
    joinDmEnabled: settings?.joinDmEnabled ?? false,
    joinDmBlocks: settings?.joinDmBlocks ?? DEFAULT_BLOCKS.joinDmBlocks,
    leaveEnabled: settings?.leaveEnabled ?? false,
    leaveChannelId: settings?.leaveChannelId ?? '',
    leaveBlocks: settings?.leaveBlocks ?? DEFAULT_BLOCKS.leaveBlocks,
    banEnabled: settings?.banEnabled ?? false,
    banChannelId: settings?.banChannelId ?? '',
    banBlocks: settings?.banBlocks ?? DEFAULT_BLOCKS.banBlocks,
    banDmEnabled: settings?.banDmEnabled ?? false,
    banDmBlocks: settings?.banDmBlocks ?? DEFAULT_BLOCKS.banDmBlocks
  };

  return (
    <ModuleShell moduleId="greet">
      <GreetBuilderForm guildId={guildId} settings={merged} textChannels={textChannels} isPremium={isPremium} />
    </ModuleShell>
  );
}
