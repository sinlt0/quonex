import Link from 'next/link';
import { prisma } from '../../../../../lib/db';
import { getUserNames } from '../../../../../lib/guildResources';
import { requireSecurity } from '../../../../../lib/securityServer';

const PAGE_SIZE = 20;
const STATUSES = ['pending', 'approved', 'denied'];
const TONE = { pending: 'text-amber-400', approved: 'text-emerald-400', denied: 'text-red-400' };

export default async function AppealsPage({ params, searchParams }) {
  const { guildId } = await params;
  const query = await searchParams;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const status = STATUSES.includes(query?.status) ? query.status : null;
  const page = Math.max(Number.parseInt(query?.page, 10) || 1, 1);
  const where = { guildId, ...(status ? { status } : {}) };
  const [rows, total, counts] = await Promise.all([
    prisma.modAppeal.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.modAppeal.count({ where }),
    prisma.modAppeal.groupBy({ by: ['status'], where: { guildId }, _count: true })
  ]);
  const names = await getUserNames(rows.flatMap(row => [row.userId, row.reviewerId]).filter(Boolean));
  const label = id => names[id] || id;
  const countOf = key => counts.find(item => item.status === key)?._count || 0;

  const base = `/servers/${guildId}/security/appeals`;
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
      <p className="text-sm text-neutral-400">Appeals are reviewed in Discord with the Approve and Deny buttons, or /appeal list. This page is a read-only history.</p>
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
        {rows.length === 0 && <p className="p-5 text-sm text-neutral-400">No appeals yet.</p>}
        {rows.map(row => (
          <div key={row.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-neutral-500">#{row.number}</span>
              <span className={`text-xs font-semibold uppercase ${TONE[row.status]}`}>{row.status}</span>
              <span className="font-medium">
                {label(row.userId)} ({row.userId})
              </span>
              <span className="text-xs text-neutral-500">{row.createdAt.toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{row.text}</p>
            {row.reviewerId && (
              <p className="mt-1 text-xs text-neutral-400">
                Reviewed by {label(row.reviewerId)}
                {row.reviewNote ? `: ${row.reviewNote}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>
          Page {page} of {pages} · {total} appeals
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
    </div>
  );
}
