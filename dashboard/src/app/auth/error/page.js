import Link from 'next/link';
import { signIn } from '../../../auth';

const EXPLANATIONS = {
  Configuration: 'The dashboard is missing sign-in settings. The server owner needs to check AUTH_SECRET, AUTH_DISCORD_ID and AUTH_DISCORD_SECRET.',
  AccessDenied: 'Discord reported that access was denied. If you pressed Cancel, just try again.',
  OAuthSignin: 'Could not start the Discord sign-in. Discord may be having problems, or the Discord application settings are wrong.',
  OAuthCallbackError: 'Discord returned an error while finishing the sign-in. Check that the redirect URL in the Discord developer portal matches the dashboard address, then try again.',
  OAuthCallback: 'Discord returned an error while finishing the sign-in. Check that the redirect URL in the Discord developer portal matches the dashboard address, then try again.',
  Callback: 'Something went wrong while finishing the sign-in. Please try again.',
  Verification: 'That sign-in link is no longer valid.'
};

export default async function AuthErrorPage({ searchParams }) {
  const query = await searchParams;
  const code = typeof query?.error === 'string' ? query.error : 'Default';
  const text = EXPLANATIONS[code] || 'Sign-in failed. Discord may be having issues right now, please try again in a minute.';

  return (
    <div className="fade-in-up mx-auto flex max-w-md flex-col gap-6 px-4 py-24">
      <div className="dash-card space-y-4 p-8 text-center">
        <p className="text-lg font-semibold">Could not sign in</p>
        <p className="text-sm text-neutral-400">{text}</p>
        <p className="text-xs text-neutral-500">Error code: {code}</p>
        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: '/servers' });
          }}
        >
          <button type="submit" className="dash-btn dash-btn-primary px-6 py-2">
            Try again
          </button>
        </form>
        <Link href="/" className="block text-xs text-neutral-400 hover:text-white">
          Back to home
        </Link>
      </div>
    </div>
  );
}
