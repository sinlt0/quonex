'use client';

import { useMemo, useState } from 'react';

export default function CommandSearch({ commands }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;

    return commands.filter(
      command =>
        command.name.toLowerCase().includes(normalized) ||
        command.description.toLowerCase().includes(normalized) ||
        command.usage.toLowerCase().includes(normalized) ||
        command.category.toLowerCase().includes(normalized)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const command of filtered) {
      if (!map.has(command.category)) map.set(command.category, []);
      map.get(command.category).push(command);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search commands..."
        className="w-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-sm outline-none transition-all duration-150 ease-out focus:border-violet-500 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/20"
      />
      <div className="mt-10 space-y-10">
        {[...grouped.entries()].map(([category, categoryCommands]) => (
          <section key={category}>
            <h2 className="text-xl font-medium">{category}</h2>
            <div className="mt-4 space-y-3">
              {categoryCommands.map(command => (
                <div
                  key={`${command.type}-${command.name}`}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10 hover:shadow-xl hover:shadow-violet-500/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="min-w-0 break-all text-sm text-violet-300">{command.usage}</code>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                      {command.type === 'slash' ? 'Slash' : 'Prefix'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">{command.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && <p className="text-neutral-400">No commands match &ldquo;{query}&rdquo;.</p>}
      </div>
    </div>
  );
}
