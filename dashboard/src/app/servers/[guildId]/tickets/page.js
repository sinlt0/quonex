import { prisma } from '../../../../lib/db';
import TicketsShell from '../panels/TicketsShell';
import TicketActions from './TicketActions';

export default async function TicketsPage({ params }) {
  const { guildId } = await params;
  const tickets = await prisma.ticket.findMany({
    where: { guildId, status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  if (!tickets.length) {
    return (
      <TicketsShell guildId={guildId}>
        <p className="text-sm text-neutral-400">No open tickets.</p>
      </TicketsShell>
    );
  }

  return (
    <TicketsShell guildId={guildId}>
    <div className="dash-card overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="text-neutral-400">
          <tr>
            <th className="px-4 py-2">Number</th>
            <th className="px-4 py-2">Opener</th>
            <th className="px-4 py-2">Claimed By</th>
            <th className="px-4 py-2">Opened</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(ticket => (
            <tr key={ticket.id} className="border-t border-[#1c2030] transition-colors duration-150 hover:bg-[#121623]">
              <td className="px-4 py-2">#{String(ticket.number).padStart(4, '0')}</td>
              <td className="px-4 py-2">{ticket.openerId}</td>
              <td className="px-4 py-2">{ticket.claimedBy || '—'}</td>
              <td className="px-4 py-2">{new Date(ticket.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2">
                <TicketActions guildId={guildId} ticket={ticket} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TicketsShell>
  );
}
