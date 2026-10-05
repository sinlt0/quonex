import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs');

export function getAllDocs() {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.md'));

  const docs = files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
    const { data } = matter(raw);

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      order: typeof data.order === 'number' ? data.order : 999
    };
  });

  return docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getDocBySlug(slug) {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    html: marked.parse(content)
  };
}
