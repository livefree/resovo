import type { DoubanCelebrityWorkItem } from './celebrity-works.types.js';

export function parseDoubanCelebrityWorksHtml(
  html: string,
): DoubanCelebrityWorkItem[] {
  const results: DoubanCelebrityWorkItem[] = [];
  const blocks = html.split('<div class="result">').slice(1);

  for (const block of blocks) {
    const idMatch = block.match(/movie\.douban\.com%2Fsubject%2F(\d+)/);
    if (!idMatch) {
      continue;
    }
    const id = idMatch[1];

    const posterMatch = block.match(/<img[^>]*src="([^"]+)"/);
    const poster = posterMatch ? posterMatch[1] : '';

    const rateMatch = block.match(/<span class="rating_nums">([^<]*)<\/span>/);
    const rate = rateMatch ? rateMatch[1] : '';

    const castMatch = block.match(
      /<span class="subject-cast">([^<]*)<\/span>/,
    );
    let title = '';
    if (castMatch) {
      const titleMatch = castMatch[1].match(/原名:([^/]+)/);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    if (!title) {
      const titleMatch = block.match(/class="title-text">([^<]+)<\/a>/);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    if (id && title) {
      results.push({
        id,
        title,
        poster,
        rate,
        url: `https://movie.douban.com/subject/${id}/`,
        source: 'douban',
      });
    }
  }

  return results;
}
