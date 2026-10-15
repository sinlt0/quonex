import Link from 'next/link';
import { prisma } from '../../../../lib/db';
import { limitFor } from '../../../../lib/panelLimits';
import { getGuildChannels } from '../../../../lib/guildResources';
import RolesShell from './RolesShell';
import CreateMessageForm from './CreateMessageForm';
import { deleteInteractiveAction, duplicateInteractiveAction } from './actions';

export default async function RolesPage({ params }) {
  const { guildId } = await params;

  const [rows, limit, { textChannels }] = await Promise.all([
    prisma.interactiveMessage.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    limitFor(guildId, 'interactiveMessages'),
    getGuildChannels(guildId)
  ]);

  const channelName = id => textChannels.find(channel => channel.id === id)?.name || id;

  return (
    <RolesShell guildId={guildId}>
      <CreateMessageForm guildId={guildId} used={rows.length} limit={limit} />

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const blocks = Array.isArray(row.blocks) ? row.blocks : [];
            const interactive = blocks.filter(block => block.type === 'actions' || block.type === 'select').length;
            return (
              <div key={row.id} className="dash-card flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-semibold">{row.name}</p>
                  <p className="mt-0.5 text-sm text-neutral-400">
                    {blocks.length} blocks • {interactive} interactive • {row.channelId ? `live in #${channelName(row.channelId)}` : 'draft'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/servers/${guildId}/roles/${row.id}`} className="dash-btn dash-btn-primary">
                    Edit
                  </Link>
                  <form action={duplicateInteractiveAction.bind(null, guildId, row.id)}>
                    <button type="submit" className="dash-btn">
                      Duplicate
                    </button>
                  </form>
                  <form action={deleteInteractiveAction.bind(null, guildId, row.id)}>
                    <button type="submit" className="dash-btn text-red-300">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RolesShell>
  );
}
