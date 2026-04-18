import { DoubanError } from './errors.js';
import type {
  DoubanResolveSubjectInput,
  DoubanResolvedCandidate,
  DoubanSubjectType,
} from './resolver.types.js';

interface RawDoubanSearchItem {
  id?: string | number;
  title?: string;
  original_title?: string;
  abstract?: string;
  card_subtitle?: string;
  target_type?: string;
  type?: string;
  url?: string;
  cover_url?: string;
  rating?: {
    value?: number;
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[\s\-_:,.!?'"/\\()（）[\]【】]+/g, '')
    .trim();
}

function normalizeYear(year?: number | string | null): string | null {
  if (year === null || year === undefined || year === '') {
    return null;
  }

  const match = String(year).match(/\d{4}/);
  return match ? match[0] : null;
}

function parseItemYear(item: RawDoubanSearchItem): string | null {
  const combinedText = [item.abstract, item.card_subtitle, item.title]
    .filter(Boolean)
    .join(' ');

  const match = combinedText.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function inferSubjectType(item: RawDoubanSearchItem): DoubanSubjectType {
  const typeText = `${item.target_type ?? ''} ${item.type ?? ''} ${item.abstract ?? ''}`;

  if (/动画|anime/i.test(typeText)) {
    return 'anime';
  }

  if (/电视剧|剧集|tv|television|季/.test(typeText)) {
    return 'tv';
  }

  if (/电影|movie|film/.test(typeText)) {
    return 'movie';
  }

  return 'unknown';
}

function getCandidateSearchText(candidate: DoubanResolvedCandidate): string {
  return [
    candidate.title,
    candidate.originalTitle,
    candidate.abstract,
  ]
    .filter(Boolean)
    .join(' ');
}

export function getResolveSearchQuery(
  input: DoubanResolveSubjectInput,
): string {
  const aliases = (input.aliases ?? []).filter(Boolean);
  const queryParts = [input.title.trim(), aliases[0]?.trim()].filter(Boolean);
  return queryParts[0] ?? '';
}

export function buildSubjectSearchUrl(query: string): string {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new DoubanError('Search query is required', 'PARSE_ERROR', 400);
  }

  return `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(trimmedQuery)}&cat=1002`;
}

export function parseSearchPageData(html: string): unknown[] {
  const dataMatch = html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!dataMatch) {
    throw new DoubanError(
      'Unable to parse subject search payload',
      'PARSE_ERROR',
      502,
    );
  }

  const parsed = JSON.parse(dataMatch[1]) as { items?: unknown[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

export function normalizeSearchCandidate(
  raw: unknown,
): DoubanResolvedCandidate | null {
  const item = raw as RawDoubanSearchItem;
  if (!item?.id || !item.title) {
    return null;
  }

  return {
    id: String(item.id),
    title: item.title.trim(),
    originalTitle: item.original_title?.trim() || null,
    year: parseItemYear(item),
    type: inferSubjectType(item),
    url: item.url ?? null,
    coverUrl: item.cover_url ?? null,
    rating: item.rating?.value ?? null,
    abstract: item.abstract ?? item.card_subtitle ?? null,
    raw,
    score: 0,
    scoreBreakdown: [],
  };
}

export function scoreCandidate(
  input: DoubanResolveSubjectInput,
  candidate: DoubanResolvedCandidate,
): DoubanResolvedCandidate {
  const breakdown: Array<{ reason: string; points: number }> = [];
  const inputTitle = normalizeText(input.title);
  const aliases = (input.aliases ?? []).map(normalizeText).filter(Boolean);
  const inputYear = normalizeYear(input.year);
  const candidateYear = normalizeYear(candidate.year);
  const candidateTexts = [
    normalizeText(candidate.title),
    normalizeText(candidate.originalTitle),
  ].filter(Boolean);
  const candidateSearchText = normalizeText(getCandidateSearchText(candidate));

  if (candidateTexts.includes(inputTitle)) {
    breakdown.push({ reason: 'title-exact', points: 80 });
  } else if (candidateTexts.some((text) => text.includes(inputTitle) || inputTitle.includes(text))) {
    breakdown.push({ reason: 'title-partial', points: 45 });
  }

  if (aliases.some((alias) => candidateTexts.includes(alias))) {
    breakdown.push({ reason: 'alias-exact', points: 60 });
  } else if (aliases.some((alias) => candidateSearchText.includes(alias))) {
    breakdown.push({ reason: 'alias-partial', points: 30 });
  }

  if (inputYear && candidateYear) {
    if (inputYear === candidateYear) {
      breakdown.push({ reason: 'year-exact', points: 25 });
    } else if (Math.abs(Number(inputYear) - Number(candidateYear)) === 1) {
      breakdown.push({ reason: 'year-near', points: 10 });
    } else {
      breakdown.push({ reason: 'year-mismatch', points: -20 });
    }
  }

  if (input.type && input.type !== 'unknown') {
    if (candidate.type === input.type) {
      breakdown.push({ reason: 'type-match', points: 15 });
    } else if (candidate.type !== 'unknown') {
      breakdown.push({ reason: 'type-mismatch', points: -10 });
    }
  }

  for (const actor of input.actors ?? []) {
    const normalizedActor = normalizeText(actor);
    if (normalizedActor && candidateSearchText.includes(normalizedActor)) {
      breakdown.push({ reason: `actor:${actor}`, points: 12 });
    }
  }

  const score = breakdown.reduce((sum, item) => sum + item.points, 0);

  return {
    ...candidate,
    score,
    scoreBreakdown: breakdown,
  };
}

export function rankCandidates(
  input: DoubanResolveSubjectInput,
  candidates: DoubanResolvedCandidate[],
): DoubanResolvedCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(input, candidate))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftRating = left.rating ?? -1;
      const rightRating = right.rating ?? -1;
      if (rightRating !== leftRating) {
        return rightRating - leftRating;
      }

      return left.id.localeCompare(right.id);
    });
}
