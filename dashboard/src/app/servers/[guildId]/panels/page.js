import { prisma } from '../../../../lib/db';
import { getGuildChannels, getGuildRoles } from '../../../../lib/guildResources';
import CreatePanelForm from './CreatePanelForm';
import PanelManageCard from './PanelManageCard';

export default async function PanelsPage({ params }) {
  const { guildId } = await params;

  const [panels, { textChannels, categories }, roles] = await Promise.all([
    prisma.panel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId)
  ]);

  return (
    <div className="fade-in-up space-y-6">
      <CreatePanelForm guildId={guildId} categories={categories} roles={roles} textChannels={textChannels} />
      {panels.length === 0 ? (
        <p className="text-neutral-400">No panels yet.</p>
      ) : (
        <div className="space-y-3">
          {panels.map(panel => (
            <PanelManageCard key={panel.id} guildId={guildId} panel={panel} categories={categories} roles={roles} />
          ))}
        </div>
      )}
    </div>
  );
}
