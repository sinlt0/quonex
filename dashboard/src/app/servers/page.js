import { redirect } from 'next/navigation';
import { auth, signOut } from '../../auth';
import { getMutualGuilds, guildIconUrl } from '../../lib/discord';
import { BOT_NAME } from '../../lib/branding';
import ServerCard from '../../components/ServerCard';

export default async function ServersPage() {
  const session = await auth();
  if (!session?.accessToken) redirect('/');

  const guilds = await getMutualGuilds(session.accessToken);

  return (
    <div className="fade-in-up mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Your Servers</h1>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button type="submit" className="text-sm text-neutral-400 transition-colors duration-200 hover:text-violet-300">
            Sign out
          </button>
        </form>
      </div>
      {guilds.length === 0 ? (
        <p className="text-neutral-400">
          No mutual servers found. Make sure {BOT_NAME} is invited to a server where you have Manage Server permission.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {guilds.map(guild => (
            <ServerCard key={guild.id} guild={guild} iconUrl={guildIconUrl(guild)} />
          ))}
        </div>
      )}
    </div>
  );
}
