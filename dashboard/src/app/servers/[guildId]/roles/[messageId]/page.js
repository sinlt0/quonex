import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '../../../../../lib/db';
import { getGuildChannels, getGuildRoles } from '../../../../../lib/guildResources';
import InteractiveEditor from './InteractiveEditor';

export default async function EditInteractivePage({ params }) {
  const { guildId, messageId } = await params;

  const row = await prisma.interactiveMessage.findUnique({ where: { id: messageId } });
  if (!row || row.guildId !== guildId) notFound();

  const [others, { textChannels }, roles] = await Promise.all([
    prisma.interactiveMessage.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId)
  ]);

  return (
    <div className="fade-in-up space-y-6">
      <Link href={`/servers/${guildId}/roles`} className="inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white">
        <span aria-hidden="true">←</span>
        Roles &amp; Buttons
      </Link>
      <InteractiveEditor
        guildId={guildId}
        messageId={row.id}
        initialName={row.name}
        initialBlocks={Array.isArray(row.blocks) ? row.blocks : []}
        initialAccent={row.accentColor || ''}
        initialLogChannelId={row.logChannelId || ''}
        liveChannelId={row.channelId || ''}
        textChannels={textChannels}
        roles={roles}
        messages={others}
      />
    </div>
  );
}
