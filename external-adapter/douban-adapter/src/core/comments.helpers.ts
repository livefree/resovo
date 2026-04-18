import { DoubanError } from './errors.js';
import { normalizeSubjectId } from './details.helpers.js';

export const DEFAULT_COMMENTS_LIMIT = 10;
export const MAX_COMMENTS_LIMIT = 50;
export const DEFAULT_COMMENTS_SORT = 'new_score';

export function getCommentsCacheKey(
  subjectId: string,
  start = 0,
  limit = DEFAULT_COMMENTS_LIMIT,
  sort = DEFAULT_COMMENTS_SORT,
): string {
  return `douban-comments:id=${normalizeSubjectId(subjectId)}&start=${start}&limit=${limit}&sort=${sort}`;
}

export function getSubjectCommentsUrl(
  subjectId: string,
  start = 0,
  limit = DEFAULT_COMMENTS_LIMIT,
  sort = DEFAULT_COMMENTS_SORT,
): string {
  const normalizedId = normalizeSubjectId(subjectId);
  return `https://movie.douban.com/subject/${normalizedId}/comments?start=${start}&limit=${limit}&status=P&sort=${sort}`;
}

export function validateCommentsRequest(
  start = 0,
  limit = DEFAULT_COMMENTS_LIMIT,
): void {
  if (start < 0) {
    throw new DoubanError('start must be greater than or equal to 0', 'PARSE_ERROR', 400);
  }

  if (limit < 1 || limit > MAX_COMMENTS_LIMIT) {
    throw new DoubanError(
      `limit must be between 1 and ${MAX_COMMENTS_LIMIT}`,
      'PARSE_ERROR',
      400,
    );
  }
}
