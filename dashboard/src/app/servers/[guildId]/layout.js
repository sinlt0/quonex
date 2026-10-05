import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { getMutualGuilds } from '../../../lib/discord';
import NavTabs from '../../../components/NavTabs';

export default async function GuildLayout({ children, params }) {
  const { guildId } = await params;
  const session = await auth();
  if (!session?.accessToken) redirect('/');

  const guilds = await getMutualGuilds(session.accessToken);
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) redirect('/servers');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="min-w-0 break-words text-2xl font-semibold">{guild.name}</h1>
        <a href="/servers" className="shrink-0 text-sm text-neutral-400 transition-colors duration-200 hover:text-violet-300">
          All servers
        </a>
      </div>
      <NavTabs guildId={guildId} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
