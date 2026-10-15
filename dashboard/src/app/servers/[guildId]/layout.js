import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { getMutualGuilds } from '../../../lib/discord';
import { prisma } from '../../../lib/db';
import Sidebar from '../../../components/dash/Sidebar';

export default async function GuildLayout({ children, params }) {
  const { guildId } = await params;
  const session = await auth();
  if (!session?.accessToken) redirect('/');

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) redirect('/servers');

  const [greet, levels, panelCount, applicationPanelCount, liveInteractiveCount] = await Promise.all([
    prisma.greetSettings.findUnique({ where: { guildId } }),
    prisma.levelSettings.findUnique({ where: { guildId } }),
    prisma.panel.count({ where: { guildId } }),
    prisma.applicationPanel.count({ where: { guildId } }),
    prisma.interactiveMessage.count({ where: { guildId, messageId: { not: null } } })
  ]);

  const statuses = {
    greet: Boolean(greet?.joinEnabled || greet?.leaveEnabled || greet?.banEnabled),
    levels: Boolean(levels?.enabled),
    roles: liveInteractiveCount > 0,
    applications: applicationPanelCount > 0,
    tickets: panelCount > 0
  };

  return (
    <div className="dash-root mx-auto max-w-7xl px-4 py-8">
      <Link href="/servers" className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white">
        <span aria-hidden="true">←</span>
        <span className="truncate">{guild.name}</span>
      </Link>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar guildId={guildId} statuses={statuses} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
