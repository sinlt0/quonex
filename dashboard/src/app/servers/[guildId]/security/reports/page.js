import Link from 'next/link';
import { prisma } from '../../../../../lib/db';
import { getUserNames } from '../../../../../lib/guildResources';
import { requireSecurity } from '../../../../../lib/securityServer';

const PAGE_SIZE = 20;
const STATUSES = ['open', 'resolved', 'dismissed'];
const TONE = { open: 'text-amber-400', resolved: 'text-emerald-400', dismissed: 'text-neutral-400' };

export default async function ReportsPage({ params, searchParams }) {
  const { guildId } = await params;
  const query = await searchParams;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const status = STATUSES.includes(query?.status) ? query.status : null;
  const page = Math.max(Number.parseInt(query?.page, 10) || 1, 1);
  const where = { guildId, ...(status ? { status } : {}) };
  const [rows, total, counts, watchlist, notes] = await Promise.all([
    prisma.modReport.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.modReport.count({ where }),
    prisma.modReport.groupBy({ by: ['status'], where: { guildId }, _count: true }),
    prisma.modWatch.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.modNote.count({ where: { guildId } })
  ]);
  const names = await getUserNames([...rows.flatMap(row => [row.targetId, row.handlerId]), ...watchlist.map(item => item.userId)].filter(Boolean));
  const label = id => names[id] || id;
  const countOf = key => counts.find(item => item.status === key)?._count || 0;

  const base = `/servers/${guildId}/security/reports`;
  const href = (next = {}) => {
    const search = new URLSearchParams();
    const merged = { status, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) if (value && !(key === 'page' && value === '1')) search.set(key, value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">Reports are handled in Discord with the buttons on each report. This page is a read-only history. {notes} staff note{notes === 1 ? '' : 's'} on record.</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={href({ status: null, page: '1' })} className={`dash-btn ${!status ? 'dash-btn-primary' : ''}`}>
          All
        </Link>
        {STATUSES.map(item => (
          <Link key={item} href={href({ status: item, page: '1' })} className={`dash-btn ${status === item ? 'dash-btn-primary' : ''}`}>
            {item} ({countOf(item)})
          </Link>
        ))}
      </div>

      <div className="dash-card divide-y divide-[#1c2030]">
        {rows.length === 0 && <p className="p-5 text-sm text-neutral-400">No reports yet.</p>}
        {rows.map(row => (
          <div key={row.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-neutral-500">#{row.number}</span>
              <span className={`text-xs font-semibold uppercase ${TONE[row.status]}`}>{row.status}</span>
              <span className="font-medium">
                {label(row.targetId)} ({row.targetId})
              </span>
              <span className="text-xs text-neutral-500">
                {row.reporterIds.length} report{row.reporterIds.length === 1 ? '' : 's'} · {row.createdAt.toLocaleString()}
              </span>
            </div>
            {row.content && <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{row.content}</p>}
            {row.reasons[0] && <p className="mt-1 text-xs text-neutral-400">Reason: {row.reasons[0]}</p>}
            {row.handlerId && <p className="mt-1 text-xs text-neutral-400">Closed by {label(row.handlerId)}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>
          Page {page} of {pages} · {total} reports
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={href({ page: String(page - 1) })} className="dash-btn">
              Previous
            </Link>
          )}
          {page < pages && (
            <Link href={href({ page: String(page + 1) })} className="dash-btn">
              Next
            </Link>
          )}
        </div>
      </div>

      <div className="dash-card p-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Watchlist ({watchlist.length})</p>
        <div className="mt-3 space-y-1 text-sm">
          {watchlist.length === 0 && <p className="text-neutral-500">Nobody is on the watchlist. Use /watchlist add in Discord.</p>}
          {watchlist.map(item => (
            <p key={item.userId}>
              {label(item.userId)} <span className="text-neutral-500">· {item.reason || 'No reason'}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
