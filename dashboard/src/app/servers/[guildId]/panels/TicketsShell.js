import { prisma } from '../../../../lib/db';
import ModuleShell from '../../../../components/dash/ModuleShell';

export default async function TicketsShell({ guildId, children }) {
  const [panelCount, openCount] = await Promise.all([
    prisma.panel.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: 'open' } })
  ]);

  const tabs = [
    { href: `/servers/${guildId}/panels`, label: 'Panels', count: panelCount },
    { href: `/servers/${guildId}/tickets`, label: 'Open tickets', count: openCount }
  ];

  return (
    <ModuleShell moduleId="tickets" tabs={tabs}>
      {children}
    </ModuleShell>
  );
}
