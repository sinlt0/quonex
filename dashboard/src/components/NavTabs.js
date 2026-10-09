'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/panels', label: 'Panels' },
  { href: '/applications', label: 'Applications' },
  { href: '/settings', label: 'Settings' }
];

export default function NavTabs({ guildId }) {
  const pathname = usePathname();
  const base = `/servers/${guildId}`;

  return (
    <nav className="flex gap-4 border-b border-white/10 pb-2">
      {TABS.map(tab => {
        const href = `${base}${tab.href}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={
              active
                ? 'relative font-medium text-violet-300 after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-violet-400'
                : 'text-neutral-400 transition-colors duration-200 hover:text-neutral-100'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
