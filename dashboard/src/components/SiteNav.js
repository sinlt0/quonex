'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOT_NAME } from '../lib/branding';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/docs', label: 'Docs' },
  { href: '/commands', label: 'Commands' },
  { href: '/credits', label: 'Credits' },
  { href: '/changelog', label: 'Changelog' }
];

export default function SiteNav({ botAvatarUrl }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-3 px-4 py-4">
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-semibold transition-all duration-150 ease-out hover:scale-[1.03]"
        >
          {botAvatarUrl && (
            <img
              src={botAvatarUrl}
              alt={BOT_NAME}
              className="h-8 w-8 rounded-full border border-white/10 transition-all duration-150 ease-out group-hover:border-violet-400 group-hover:shadow-lg group-hover:shadow-violet-500/40"
            />
          )}
          <span className="transition-colors duration-150 group-hover:text-violet-300">{BOT_NAME}</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? 'font-medium text-violet-300'
                  : 'text-neutral-400 transition-colors duration-200 hover:text-neutral-100'
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/servers"
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition-all duration-200 hover:scale-105 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
