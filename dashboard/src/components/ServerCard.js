import Link from 'next/link';

export default function ServerCard({ guild, iconUrl }) {
  return (
    <Link
      href={`/servers/${guild.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10 hover:shadow-xl hover:shadow-violet-500/25 active:translate-y-0"
    >
      {iconUrl ? (
        <img src={iconUrl} alt={guild.name} className="h-10 w-10 rounded-full" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm">
          {guild.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="min-w-0 break-words font-medium">{guild.name}</span>
    </Link>
  );
}
