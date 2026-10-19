import Link from 'next/link';
import { prisma } from '../../../../../lib/db';
import { getUserNames } from '../../../../../lib/guildResources';
import { requireSecurity } from '../../../../../lib/securityServer';

const PAGE_SIZE = 25;
const DAYS = 30;
const ACTIONS = ['ban', 'tempban', 'softban', 'unban', 'kick', 'timeout', 'untimeout', 'warn', 'quarantine'];
const SNOWFLAKE = /^\d{15,22}$/;
const TONE = { ban: 'text-red-400', tempban: 'text-red-400', softban: 'text-red-300', kick: 'text-amber-400', timeout: 'text-amber-300', warn: 'text-yellow-300', quarantine: 'text-orange-300', unban: 'text-emerald-400', untimeout: 'text-emerald-400' };

function formatMinutes(minutes) {
  if (!minutes) return null;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

export default async function CasesPage({ params, searchParams }) {
  const { guildId } = await params;
  const query = await searchParams;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const action = ACTIONS.includes(query?.action) ? query.action : null;
  const user = SNOWFLAKE.test(query?.user || '') ? query.user : null;
  const moderator = SNOWFLAKE.test(query?.mod || '') ? query.mod : null;
  const page = Math.max(Number.parseInt(query?.page, 10) || 1, 1);
  const where = { guildId, ...(action ? { action } : {}), ...(user ? { userId: user } : {}), ...(moderator ? { moderatorId: moderator } : {}) };
  const since = new Date(Date.now() - DAYS * 86400000);

  const [rows, total, recent] = await Promise.all([
    prisma.modCase.findMany({ where, orderBy: { caseNumber: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.modCase.count({ where }),
    prisma.modCase.findMany({ where: { guildId, createdAt: { gte: since } }, select: { action: true, moderatorId: true, auto: true, createdAt: true }, take: 20000 })
  ]);

  const perDay = Array.from({ length: DAYS }, () => 0);
  const byAction = {};
  const byModerator = {};
  let auto = 0;
  for (const row of recent) {
    const index = DAYS - 1 - Math.floor((Date.now() - row.createdAt.getTime()) / 86400000);
    if (index >= 0 && index < DAYS) perDay[index] += 1;
    byAction[row.action] = (byAction[row.action] || 0) + 1;
    if (row.auto) auto += 1;
    else byModerator[row.moderatorId] = (byModerator[row.moderatorId] || 0) + 1;
  }
  const topModerators = Object.entries(byModerator).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const peak = Math.max(...perDay, 1);

  const names = await getUserNames([...rows.flatMap(row => [row.userId, row.moderatorId]), ...topModerators.map(([id]) => id)]);
  const label = id => names[id] || id;

  const base = `/servers/${guildId}/security/cases`;
  const href = (next = {}) => {
    const search = new URLSearchParams();
    const merged = { action, user, mod: moderator, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) if (value && !(key === 'page' && value === '1')) search.set(key, value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="dash-card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Last {DAYS} days</p>
          <p className="mt-1 text-3xl font-semibold">{recent.length}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {recent.length - auto} by moderators · {auto} automatic
          </p>
        </div>
        <div className="dash-card p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Actions per day</p>
          <div className="mt-3 flex h-20 items-end gap-[3px]">
            {perDay.map((count, index) => (
              <div key={index} title={`${count} action${count === 1 ? '' : 's'}`} className="flex-1 rounded-sm bg-[#8b7cf6]" style={{ height: `${Math.max((count / peak) * 100, count ? 6 : 2)}%`, opacity: count ? 1 : 0.2 }} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dash-card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">By action</p>
          <div className="mt-3 space-y-1 text-sm">
            {Object.keys(byAction).length === 0 && <p className="text-neutral-500">No actions yet.</p>}
            {Object.entries(byAction).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <div key={name} className="flex justify-between">
                <span className={TONE[name] || 'text-neutral-300'}>{name}</span>
                <span className="text-neutral-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dash-card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Top moderators</p>
          <div className="mt-3 space-y-1 text-sm">
            {topModerators.length === 0 && <p className="text-neutral-500">No moderator actions yet.</p>}
            {topModerators.map(([id, count]) => (
              <div key={id} className="flex justify-between">
                <Link href={href({ mod: id, page: '1' })} className="hover:underline">
                  {label(id)}
                </Link>
                <span className="text-neutral-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
        <label className="text-neutral-400">
          User ID
          <input name="user" defaultValue={user || ''} placeholder="Any user" className="dash-input mt-1 block w-48" />
        </label>
        <label className="text-neutral-400">
          Moderator ID
          <input name="mod" defaultValue={moderator || ''} placeholder="Anyone" className="dash-input mt-1 block w-48" />
        </label>
        {action && <input type="hidden" name="action" value={action} />}
        <button type="submit" className="dash-btn dash-btn-primary">
          Search
        </button>
        {(user || moderator) && (
          <Link href={href({ user: null, mod: null, page: '1' })} className="dash-btn">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={href({ action: null, page: '1' })} className={`dash-btn ${!action ? 'dash-btn-primary' : ''}`}>
          All actions
        </Link>
        {ACTIONS.map(item => (
          <Link key={item} href={href({ action: item, page: '1' })} className={`dash-btn ${action === item ? 'dash-btn-primary' : ''}`}>
            {item}
          </Link>
        ))}
      </div>

      <div className="dash-card divide-y divide-[#1c2030]">
        {rows.length === 0 && <p className="p-5 text-sm text-neutral-400">No cases match.</p>}
        {rows.map(row => (
          <div key={row.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-neutral-500">#{row.caseNumber}</span>
              <span className={`text-xs font-semibold uppercase ${TONE[row.action] || 'text-neutral-300'}`}>{row.action}</span>
              {row.duration ? <span className="text-xs text-neutral-400">{formatMinutes(row.duration)}</span> : null}
              {row.auto && <span className="rounded bg-[#171b2a] px-2 py-0.5 text-xs text-neutral-300">auto</span>}
              {row.action === 'warn' && !row.active && <span className="text-xs text-neutral-500">inactive</span>}
              <span className="text-xs text-neutral-500">{row.createdAt.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {label(row.userId)} ({row.userId}) · by {label(row.moderatorId)}
            </p>
            {row.reason && <p className="mt-1 text-sm text-neutral-300">{row.reason}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>
          Page {page} of {pages} · {total} cases
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
