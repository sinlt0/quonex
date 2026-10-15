import Link from 'next/link';
import { prisma } from '../../../lib/db';
import ModuleIcon from '../../../components/dash/ModuleIcon';
import { MODULES } from '../../../lib/modules';

export default async function GuildOverviewPage({ params }) {
  const { guildId } = await params;

  const [guildRow, panelCount, openTicketCount, pendingApplicationCount, greet, levels, applicationPanelCount, liveInteractiveCount] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId }, include: { premium: true } }),
    prisma.panel.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: 'open' } }),
    prisma.application.count({ where: { guildId, status: 'pending' } }),
    prisma.greetSettings.findUnique({ where: { guildId } }),
    prisma.levelSettings.findUnique({ where: { guildId } }),
    prisma.applicationPanel.count({ where: { guildId } }),
    prisma.interactiveMessage.count({ where: { guildId, messageId: { not: null } } })
  ]);

  const premium = guildRow?.premium;
  const isPremium = premium ? premium.lifetime || (premium.expiresAt && premium.expiresAt > new Date()) : false;

  const stats = [
    { label: 'Prefix', value: guildRow?.prefix || '!' },
    { label: 'Premium', value: isPremium ? 'Active' : 'Free' },
    { label: 'Panels', value: panelCount },
    { label: 'Open tickets', value: openTicketCount },
    { label: 'Pending applications', value: pendingApplicationCount }
  ];

  const statuses = {
    greet: Boolean(greet?.joinEnabled || greet?.leaveEnabled || greet?.banEnabled),
    levels: Boolean(levels?.enabled),
    roles: liveInteractiveCount > 0,
    applications: applicationPanelCount > 0,
    tickets: panelCount > 0
  };

  return (
    <div className="fade-in-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-neutral-400">Pick a module to configure it for this server.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map(stat => (
          <div key={stat.label} className="dash-card px-4 py-3">
            <p className="dash-label">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="dash-label mb-3">Modules</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map(module => (
            <Link key={module.id} href={`/servers/${guildId}${module.href}`} className="dash-card dash-card-hover flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#171b2a] text-[#8b7cf6]">
                  <ModuleIcon name={module.icon} />
                </div>
                {statuses[module.id] !== undefined && (
                  <span className="flex items-center gap-2 text-xs text-neutral-400">
                    <span className={statuses[module.id] ? 'dash-dot dash-dot-on' : 'dash-dot'} />
                    {statuses[module.id] ? 'Active' : 'Not set up'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium">{module.label}</p>
                <p className="mt-1 text-sm text-neutral-400">{module.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
