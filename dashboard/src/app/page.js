import Link from 'next/link';
import { auth, signIn } from '../auth';
import { BOT_NAME } from '../lib/branding';
import { getSiteStats } from '../lib/stats';
import { getBotProfile } from '../lib/discord';
import StatsStrip from '../components/StatsStrip';

export default async function HomePage() {
  const session = await auth();
  const isSignedIn = Boolean(session?.accessToken);
  const [stats, botProfile] = await Promise.all([getSiteStats(), getBotProfile()]);

  return (
    <div className="fade-in-up mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      {botProfile?.avatarUrl && (
        <img
          src={botProfile.avatarUrl}
          alt={BOT_NAME}
          className="h-24 w-24 rounded-full border border-white/10 shadow-2xl shadow-violet-500/30 transition-transform duration-200 ease-out hover:scale-105"
        />
      )}
      <h1 className="text-5xl font-semibold drop-shadow-[0_0_30px_rgba(139,92,246,0.35)]">{BOT_NAME}</h1>
      <p className="max-w-xl text-lg text-neutral-400">
        A ticket management bot for Discord — panels, staff roles, intake forms, premium plans, and a dashboard to manage it all.
      </p>
      {isSignedIn ? (
        <Link
          href="/servers"
          className="rounded-lg bg-violet-600 px-6 py-3 font-medium transition-all duration-200 hover:scale-105 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
        >
          Go to Dashboard
        </Link>
      ) : (
        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: '/servers' });
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-6 py-3 font-medium transition-all duration-200 hover:scale-105 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
          >
            Sign in with Discord
          </button>
        </form>
      )}
      <div className="flex gap-4 text-sm text-neutral-400">
        <Link href="/commands" className="underline transition-colors duration-200 hover:text-violet-300">
          See all commands
        </Link>
        <Link href="/changelog" className="underline transition-colors duration-200 hover:text-violet-300">
          Changelog
        </Link>
      </div>
      <div className="w-full max-w-xl">
        <StatsStrip stats={stats} />
      </div>
    </div>
  );
}
