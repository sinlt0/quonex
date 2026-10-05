import { CHANGELOG } from '../../lib/changelog';

export const metadata = { title: 'Changelog' };

export default function ChangelogPage() {
  return (
    <div className="fade-in-up mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Changelog</h1>
      <div className="mt-10 space-y-10">
        {CHANGELOG.map(entry => (
          <section key={entry.version}>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-violet-600 px-3 py-1 text-sm font-medium shadow-md shadow-violet-500/20">
                v{entry.version}
              </span>
              <h2 className="text-lg font-medium">{entry.title}</h2>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-400">
              {entry.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
