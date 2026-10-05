import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllDocs, getDocBySlug } from '../../../lib/docs';

export function generateStaticParams() {
  return getAllDocs().map(doc => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  return { title: doc ? doc.title : 'Docs' };
}

export default async function DocPage({ params }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <div className="fade-in-up mx-auto max-w-3xl px-4 py-16">
      <Link href="/docs" className="text-sm text-neutral-400 transition-colors duration-200 hover:text-violet-300">
        ← All docs
      </Link>
      <article className="prose prose-invert mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: doc.html }} />
    </div>
  );
}
