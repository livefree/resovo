export type DoubanSubjectType = 'movie' | 'tv' | 'anime' | 'unknown';

export interface DoubanResolveSubjectInput {
  title: string;
  year?: number | string | null;
  type?: DoubanSubjectType | null;
  aliases?: string[];
  actors?: string[];
}

export interface DoubanSearchSubjectsInput {
  query: string;
  year?: number | string | null;
  type?: DoubanSubjectType | null;
  aliases?: string[];
  actors?: string[];
}

export interface DoubanResolvedCandidate {
  id: string;
  title: string;
  originalTitle?: string | null;
  year?: string | null;
  type: DoubanSubjectType;
  url?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  abstract?: string | null;
  raw?: unknown;
  score: number;
  scoreBreakdown: Array<{
    reason: string;
    points: number;
  }>;
}

export interface DoubanSearchSubjectsResult {
  query: string;
  candidates: DoubanResolvedCandidate[];
}

export interface DoubanResolveSubjectResult {
  query: string;
  chosen: DoubanResolvedCandidate | null;
  candidates: DoubanResolvedCandidate[];
}
