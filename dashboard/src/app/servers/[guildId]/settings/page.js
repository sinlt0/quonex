import { prisma } from '../../../../lib/db';
import SettingsForm from './SettingsForm';

export default async function SettingsPage({ params }) {
  const { guildId } = await params;
  const guildRow = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { premium: true, noPrefix: { include: { users: true } } }
  });

  const prefix = guildRow?.prefix || '!';
  const premium = guildRow?.premium;
  const isPremium = premium ? premium.lifetime || (premium.expiresAt && premium.expiresAt > new Date()) : false;
  const noPrefixMode = guildRow?.noPrefix?.mode || 'none';
  const noPrefixUsers = guildRow?.noPrefix?.users.map(user => user.userId) || [];

  return (
    <div className="fade-in-up space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:shadow-xl hover:shadow-violet-500/25">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Premium</p>
        <p className="mt-1 text-lg font-medium">
          {isPremium ? (premium.lifetime ? 'Lifetime' : `Active until ${new Date(premium.expiresAt).toLocaleDateString()}`) : 'Not active'}
        </p>
        <p className="mt-1 text-xs text-neutral-500">Managed by the bot's dev team, not editable here.</p>
      </div>

      <SettingsForm guildId={guildId} prefix={prefix} isPremium={isPremium} noPrefixMode={noPrefixMode} noPrefixUsers={noPrefixUsers} />
    </div>
  );
}
