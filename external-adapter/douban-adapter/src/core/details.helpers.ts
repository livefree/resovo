import { DoubanError } from './errors.js';

export function normalizeSubjectId(subjectId: string): string {
  const normalized = subjectId.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new DoubanError(
      `Invalid Douban subject id: ${subjectId}`,
      'INVALID_SUBJECT_ID',
      400,
    );
  }

  return normalized;
}

export function getSubjectPageUrl(subjectId: string): string {
  return `https://movie.douban.com/subject/${normalizeSubjectId(subjectId)}/`;
}

export function getMovieMobileApiUrl(subjectId: string): string {
  return `https://m.douban.com/rexxar/api/v2/movie/${normalizeSubjectId(
    subjectId,
  )}`;
}

export function getTvMobileApiUrl(subjectId: string): string {
  return `https://m.douban.com/rexxar/api/v2/tv/${normalizeSubjectId(
    subjectId,
  )}`;
}

export function isDoubanChallengePage(html: string): boolean {
  return (
    html.includes('sha512') &&
    html.includes('process(cha)') &&
    html.includes('载入中')
  );
}
