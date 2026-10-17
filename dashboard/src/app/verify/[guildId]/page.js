import { auth, signIn } from '../../../auth';
import { prisma } from '../../../lib/db';
import VerifyClient from './VerifyClient';

async function guildName(guildId) {
  const response = await fetch(`https://discord.com/api/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    next: { revalidate: 300 }
  }).catch(() => null);
  if (!response || !response.ok) return 'this server';
  const guild = await response.json();
  return guild.name || 'this server';
}

function Shell({ children }) {
  return (
    <div className="fade-in-up mx-auto flex max-w-md flex-col gap-6 px-4 py-24">
      <div className="dash-card space-y-5 p-8">{children}</div>
    </div>
  );
}

export default async function VerifyPage({ params, searchParams }) {
  const { guildId } = await params;
  const query = await searchParams;
  const token = typeof query?.t === 'string' ? query.t : '';
  const session = await auth();

  if (!token) {
    return (
      <Shell>
        <p className="text-center text-lg font-semibold">Verification link missing</p>
        <p className="text-center text-sm text-neutral-400">Press the verify button in the server to get your personal link.</p>
      </Shell>
    );
  }

  if (!session?.user?.id) {
    return (
      <Shell>
        <p className="text-center text-lg font-semibold">Sign in to verify</p>
        <p className="text-center text-sm text-neutral-400">We only read your Discord name and ID, so we can match this link to your account.</p>
        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: `/verify/${guildId}?t=${encodeURIComponent(token)}` });
          }}
          className="text-center"
        >
          <button type="submit" className="dash-btn dash-btn-primary px-6 py-2">
            Continue with Discord
          </button>
        </form>
      </Shell>
    );
  }

  const row = await prisma.webVerifySession.findUnique({ where: { token } });
  const valid = row && row.guildId === guildId && row.userId === session.user.id && !row.usedAt && row.expiresAt > new Date();

  if (!valid) {
    return (
      <Shell>
        <p className="text-center text-lg font-semibold">This link does not work</p>
        <p className="text-center text-sm text-neutral-400">It may have expired, already been used, or belong to a different Discord account. Press the verify button in the server again.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-center text-lg font-semibold">Verify your account</p>
      <VerifyClient token={token} guildName={await guildName(guildId)} />
    </Shell>
  );
}
