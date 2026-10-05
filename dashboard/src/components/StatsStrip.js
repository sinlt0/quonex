function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-4 text-center transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:shadow-xl hover:shadow-violet-500/25">
      <p className="text-2xl font-semibold">{value ?? '—'}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

export default function StatsStrip({ stats }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Servers" value={stats.guildCount} />
      <StatCard label="Commands" value={stats.totalCommands} />
      <StatCard label="Ping" value={stats.ping !== null ? `${stats.ping}ms` : null} />
      <StatCard label="Uptime" value={stats.uptime} />
    </div>
  );
}
