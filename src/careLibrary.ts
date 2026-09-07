import type { Db } from './db';
import { NotFoundError } from './errors';

// Staff use the care library to look up canned guidance while answering
// customer questions. Search is a plain case-insensitive scan across title,
// species and tags.
export class CareLibrary {
  constructor(private readonly db: Db) {}

  async getBySlug(slug: string) {
    const article = await this.db.plantCareArticle.findUnique({ where: { slug } });
    if (!article) throw new NotFoundError('Care article');
    return article;
  }

  async search(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const all = await this.db.plantCareArticle.findMany({
      orderBy: { title: 'asc' },
    });

    return all.filter((a) => {
      const haystack = [a.title, a.species, ...a.tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  async byTag(tag: string) {
    const t = tag.trim().toLowerCase();
    const all = await this.db.plantCareArticle.findMany({
      orderBy: { title: 'asc' },
    });
    return all.filter((a) => a.tags.map((x) => x.toLowerCase()).includes(t));
  }
}
