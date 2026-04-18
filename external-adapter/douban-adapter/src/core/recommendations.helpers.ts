import { DoubanError } from './errors.js';
import type { DoubanGetRecommendationsOptions } from './recommendations.types.js';

export const DEFAULT_RECOMMENDATIONS_LIMIT = 20;
export const MAX_RECOMMENDATIONS_LIMIT = 50;

export function getRecommendationsCacheKey(
  options: DoubanGetRecommendationsOptions,
): string {
  return [
    `douban-recommendations:kind=${options.kind}`,
    `start=${options.start ?? 0}`,
    `limit=${options.limit ?? DEFAULT_RECOMMENDATIONS_LIMIT}`,
    `category=${options.category ?? ''}`,
    `format=${options.format ?? ''}`,
    `region=${options.region ?? ''}`,
    `year=${options.year ?? ''}`,
    `platform=${options.platform ?? ''}`,
    `sort=${options.sort ?? ''}`,
    `label=${options.label ?? ''}`,
  ].join('&');
}

export function validateRecommendationsRequest(
  options: DoubanGetRecommendationsOptions,
): void {
  if (!options.kind) {
    throw new DoubanError('Recommendation kind is required', 'PARSE_ERROR', 400);
  }

  const start = options.start ?? 0;
  const limit = options.limit ?? DEFAULT_RECOMMENDATIONS_LIMIT;

  if (start < 0) {
    throw new DoubanError('start must be greater than or equal to 0', 'PARSE_ERROR', 400);
  }

  if (limit < 1 || limit > MAX_RECOMMENDATIONS_LIMIT) {
    throw new DoubanError(
      `limit must be between 1 and ${MAX_RECOMMENDATIONS_LIMIT}`,
      'PARSE_ERROR',
      400,
    );
  }
}

export function buildRecommendationsUrl(
  options: DoubanGetRecommendationsOptions,
): string {
  validateRecommendationsRequest(options);

  const selectedCategories: Record<string, string> = {
    类型: options.category ?? '',
  };

  if (options.format) {
    selectedCategories['形式'] = options.format;
  }
  if (options.region) {
    selectedCategories['地区'] = options.region;
  }

  const tags: string[] = [];
  if (options.category) {
    tags.push(options.category);
  }
  if (!options.category && options.format) {
    tags.push(options.format);
  }
  if (options.label) {
    tags.push(options.label);
  }
  if (options.region) {
    tags.push(options.region);
  }
  if (options.year) {
    tags.push(options.year);
  }
  if (options.platform) {
    tags.push(options.platform);
  }

  const params = new URLSearchParams();
  params.append('refresh', '0');
  params.append('start', String(options.start ?? 0));
  params.append('count', String(options.limit ?? DEFAULT_RECOMMENDATIONS_LIMIT));
  params.append('selected_categories', JSON.stringify(selectedCategories));
  params.append('uncollect', 'false');
  params.append('score_range', '0,10');
  params.append('tags', tags.join(','));

  if (options.sort && options.sort !== 'T') {
    params.append('sort', options.sort);
  }

  return `https://m.douban.com/rexxar/api/v2/${options.kind}/recommend?${params.toString()}`;
}
