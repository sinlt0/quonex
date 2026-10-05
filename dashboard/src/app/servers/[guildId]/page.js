import { prisma } from '../../../lib/db';

export default async function GuildOverviewPage({ params }) {
  const { guildId } = await params;

  const [guildRow, panelCount, openTicketCount] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId }, include: { premium: true } }),
    prisma.panel.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: 'open' } })
  ]);

  const prefix = guildRow?.prefix || '!';
  const premium = guildRow?.premium;
  const isPremium = premium ? premium.lifetime || (premium.expiresAt && premium.expiresAt > new Date()) : false;

  const stats = [
    { label: 'Prefix', value: prefix },
    { label: 'Premium', value: isPremium ? 'Active' : 'Free' },
    { label: 'Panels', value: panelCount },
    { label: 'Open Tickets', value: openTicketCount }
  ];

  return (
    <div className="fade-in-up grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:shadow-xl hover:shadow-violet-500/25"
        >
          <p className="text-xs uppercase tracking-wide text-neutral-500">{stat.label}</p>
          <p className="mt-1 text-xl font-semibold">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
