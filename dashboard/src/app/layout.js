import './globals.css';
import { BOT_NAME } from '../lib/branding';
import { getBotProfile } from '../lib/discord';
import SiteNav from '../components/SiteNav';
import Footer from '../components/Footer';
import CosmicBackground from '../components/CosmicBackground';

export const metadata = {
  title: `${BOT_NAME} — Discord Ticket Bot`,
  description: `${BOT_NAME} is a ticket management bot for Discord with a dashboard, intake forms, and premium plans.`
};

export default async function RootLayout({ children }) {
  const botProfile = await getBotProfile();

  return (
    <html lang="en">
      <body className="relative flex min-h-screen flex-col overflow-x-hidden text-neutral-100">
        <CosmicBackground />
        <SiteNav botAvatarUrl={botProfile?.avatarUrl} />
        <main className="relative flex-1">{children}</main>
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-6">
          <Footer />
        </div>
      </body>
    </html>
  );
}
