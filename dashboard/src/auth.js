import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const refreshing = new Map();

async function refreshAccessToken(token) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_DISCORD_ID,
      client_secret: process.env.AUTH_DISCORD_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken
    })
  });

  if (!response.ok) throw new Error(`Discord refused the refresh (${response.status})`);
  const data = await response.json();

  return {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    error: undefined
  };
}

async function refreshOnce(token) {
  const key = token.refreshToken;
  if (!refreshing.has(key)) {
    refreshing.set(
      key,
      refreshAccessToken(token).finally(() => {
        setTimeout(() => refreshing.delete(key), 5000);
      })
    );
  }
  return refreshing.get(key);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: { error: '/auth/error' },
  logger: {
    error(error) {
      const cause = error && error.cause ? error.cause.err || error.cause : null;
      console.error(`Auth error [${error && error.type ? error.type : 'unknown'}]:`, error && error.message, cause ? `| cause: ${cause.message || JSON.stringify(cause)}` : '');
    },
    warn() {}
  },
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: { params: { scope: 'identify guilds' } }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at || Math.floor(Date.now() / 1000) + (account.expires_in || 604800),
          discordId: account.providerAccountId,
          error: undefined
        };
      }

      if (token.error === 'RefreshFailed') return token;
      if (!token.refreshToken || !token.expiresAt) return { ...token, error: 'ReauthRequired' };
      if (Date.now() < (token.expiresAt - 120) * 1000) return token;

      try {
        return await refreshOnce(token);
      } catch (error) {
        console.error('Could not refresh the Discord session:', error.message);
        return { ...token, error: 'RefreshFailed' };
      }
    },
    async session({ session, token }) {
      if (token.error) {
        session.error = token.error;
        session.accessToken = undefined;
      } else {
        session.accessToken = token.accessToken;
      }
      if (session.user) session.user.id = token.discordId || token.sub;
      return session;
    }
  }
});
