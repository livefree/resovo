import { DoubanError } from './errors.js';
import type {
  DoubanCelebrityWorksMode,
  DoubanGetCelebrityWorksOptions,
} from './celebrity-works.types.js';

export const DEFAULT_CELEBRITY_WORKS_LIMIT = 20;
export const MAX_CELEBRITY_WORKS_LIMIT = 50;

export function getCelebrityWorksCacheKey(
  options: DoubanGetCelebrityWorksOptions,
): string {
  return `douban-celebrity-works:mode=${options.mode ?? 'search'}&name=${options.name.trim()}&limit=${options.limit ?? DEFAULT_CELEBRITY_WORKS_LIMIT}`;
}

export function validateCelebrityWorksRequest(
  options: DoubanGetCelebrityWorksOptions,
): void {
  if (!options.name?.trim()) {
    throw new DoubanError('Celebrity name is required', 'PARSE_ERROR', 400);
  }

  const limit = options.limit ?? DEFAULT_CELEBRITY_WORKS_LIMIT;
  if (limit < 1 || limit > MAX_CELEBRITY_WORKS_LIMIT) {
    throw new DoubanError(
      `limit must be between 1 and ${MAX_CELEBRITY_WORKS_LIMIT}`,
      'PARSE_ERROR',
      400,
    );
  }
}

export function buildCelebrityWorksUrl(
  name: string,
  mode: DoubanCelebrityWorksMode = 'search',
  limit = DEFAULT_CELEBRITY_WORKS_LIMIT,
): string {
  if (mode === 'api') {
    return `https://movie.douban.com/j/search_subjects?type=movie&tag=${encodeURIComponent(name.trim())}&page_limit=${limit}&page_start=0`;
  }

  return `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(name.trim())}`;
}
