import { prisma } from '../../../../lib/db';
import TicketActions from './TicketActions';

export default async function TicketsPage({ params }) {
  const { guildId } = await params;
  const tickets = await prisma.ticket.findMany({
    where: { guildId, status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  if (!tickets.length) {
    return <p className="fade-in-up text-neutral-400">No open tickets.</p>;
  }

  return (
    <div className="fade-in-up overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-white/5 text-neutral-400">
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
            <tr key={ticket.id} className="border-t border-white/10 transition-colors duration-150 hover:bg-white/10">
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
  );
}
