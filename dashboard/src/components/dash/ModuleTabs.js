'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ModuleTabs({ tabs }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 border-b border-[#1c2030]">
      {tabs.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors ${
              active ? 'border-[#8b7cf6] text-white' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-[#171b2a] px-2 py-0.5 text-xs text-neutral-300">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
