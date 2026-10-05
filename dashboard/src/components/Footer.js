import Link from 'next/link';
import { CREDIT, SUPPORT_SERVER } from '../lib/branding';

export default function Footer() {
  return (
    <footer className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-neutral-500">
      <p>{CREDIT}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <a href={SUPPORT_SERVER} className="underline transition-colors duration-200 hover:text-violet-300">
          Support Server
        </a>
        <Link href="/terms" className="underline transition-colors duration-200 hover:text-violet-300">
          Terms of Service
        </Link>
        <Link href="/privacy" className="underline transition-colors duration-200 hover:text-violet-300">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
