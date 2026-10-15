import { prisma } from '../../../../lib/db';
import ModuleShell from '../../../../components/dash/ModuleShell';
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
    <ModuleShell moduleId="settings">
      <div className="dash-card p-5">
        <p className="dash-label">Premium</p>
        <p className="mt-1 text-lg font-medium">
          {isPremium ? (premium.lifetime ? 'Lifetime' : `Active until ${new Date(premium.expiresAt).toLocaleDateString()}`) : 'Not active'}
        </p>
        <p className="mt-1 text-xs text-neutral-500">Managed by the bot's dev team, not editable here.</p>
      </div>

      <SettingsForm guildId={guildId} prefix={prefix} isPremium={isPremium} noPrefixMode={noPrefixMode} noPrefixUsers={noPrefixUsers} />
    </ModuleShell>
  );
}
