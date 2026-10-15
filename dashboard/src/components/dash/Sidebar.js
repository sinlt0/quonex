'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ModuleIcon from './ModuleIcon';
import { MODULES, MODULE_GROUPS } from '../../lib/modules';

export default function Sidebar({ guildId, statuses }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const base = `/servers/${guildId}`;

  const overviewActive = pathname === base;
  const isActive = module => module.matches.some(path => pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`));
  const visible = MODULES.filter(module => module.label.toLowerCase().includes(query.trim().toLowerCase()));
  const current = overviewActive ? base : MODULES.find(isActive) ? `${base}${MODULES.find(isActive).href}` : base;

  return (
    <>
      <div className="lg:hidden">
        <p className="dash-label mb-2">Navigate</p>
        <select value={current} onChange={event => router.push(event.target.value)} className="dash-input w-full">
          <option value={base}>Overview</option>
          {MODULES.map(module => (
            <option key={module.id} value={`${base}${module.href}`}>
              {module.label}
            </option>
          ))}
        </select>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-5">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter modules..."
            className="dash-input w-full"
          />

          <Link
            href={base}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              overviewActive ? 'bg-[#171b2a] text-white' : 'text-neutral-400 hover:bg-[#121623] hover:text-white'
            }`}
          >
            <ModuleIcon name="overview" className="h-4 w-4" />
            Overview
          </Link>

          {MODULE_GROUPS.map(group => {
            const items = visible.filter(module => module.group === group.id);
            if (!items.length) return null;
            return (
              <div key={group.id} className="space-y-1">
                <p className="dash-label px-3 pb-1">{group.label}</p>
                {items.map(module => (
                  <Link
                    key={module.id}
                    href={`${base}${module.href}`}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(module) ? 'bg-[#171b2a] text-white' : 'text-neutral-400 hover:bg-[#121623] hover:text-white'
                    }`}
                  >
                    <ModuleIcon name={module.icon} className="h-4 w-4" />
                    <span className="flex-1">{module.label}</span>
                    {statuses[module.id] !== undefined && (
                      <span className={statuses[module.id] ? 'dash-dot dash-dot-on' : 'dash-dot'} />
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
