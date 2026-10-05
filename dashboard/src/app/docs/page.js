import Link from 'next/link';
import { getAllDocs } from '../../lib/docs';

export const metadata = { title: 'Docs' };

export default function DocsIndexPage() {
  const docs = getAllDocs();

  return (
    <div className="fade-in-up mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Documentation</h1>
      <p className="mt-2 text-neutral-400">Guides for setting up and using the bot and dashboard.</p>
      <div className="mt-8 space-y-3">
        {docs.map(doc => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="block rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10 hover:shadow-xl hover:shadow-violet-500/25"
          >
            <p className="font-medium">{doc.title}</p>
            {doc.description && <p className="mt-1 text-sm text-neutral-400">{doc.description}</p>}
          </Link>
        ))}
        {docs.length === 0 && <p className="text-neutral-400">No docs yet.</p>}
      </div>
    </div>
  );
}
