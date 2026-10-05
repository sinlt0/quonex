import { CREDIT, SUPPORT_SERVER, TEAM_NAME } from '../../lib/branding';

export const metadata = { title: 'Credits' };

const STACK = ['Discord.js', 'Next.js', 'Prisma', 'PostgreSQL (Neon)', 'Tailwind CSS', 'Auth.js'];

export default function CreditsPage() {
  return (
    <div className="fade-in-up mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Credits</h1>
      <p className="mt-4 text-neutral-400">{CREDIT}</p>
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:shadow-xl hover:shadow-violet-500/25">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Team</p>
        <p className="mt-1 text-lg font-medium">{TEAM_NAME}</p>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:shadow-xl hover:shadow-violet-500/25">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Built With</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {STACK.map(item => (
            <li key={item} className="rounded-full bg-white/10 px-3 py-1 text-sm transition-colors duration-150 ease-out hover:bg-white/20">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <a href={SUPPORT_SERVER} className="mt-8 inline-block text-sm text-violet-300 underline transition-colors duration-150 ease-out hover:text-violet-200">
        Join the support server
      </a>
    </div>
  );
}
