import type {
  DoubanCommentsResponse,
  DoubanGetCommentsOptions,
} from '../core/comments.types.js';
import type {
  DoubanCelebrityWorksResponse,
  DoubanGetCelebrityWorksOptions,
} from '../core/celebrity-works.types.js';
import type {
  DoubanDetailsResponse,
  DoubanGetByIdOptions,
  DoubanSubjectDetails,
} from '../core/details.types.js';
import type {
  DoubanResolveSubjectInput,
  DoubanResolveSubjectResult,
  DoubanSearchSubjectsInput,
  DoubanSearchSubjectsResult,
} from '../core/resolver.types.js';
import type {
  DoubanGetRecommendationsOptions,
  DoubanRecommendationsResponse,
} from '../core/recommendations.types.js';

export interface FetchPort {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export interface LoggerPort {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface DoubanConfigPort {
  getDoubanConfig(): Promise<{
    cookies?: string | null;
    enablePuppeteer?: boolean;
  }>;
}

export interface ChallengeBypassPort {
  fetchWithVerification(url: string, init?: RequestInit): Promise<Response>;
  bypassChallenge?(
    url: string,
  ): Promise<{
    html: string;
    cookies: unknown[];
  }>;
}

export interface DoubanDetailsRuntime
  extends FetchPort,
    DoubanConfigPort,
    ChallengeBypassPort {
  cache?: CachePort;
  logger: LoggerPort;
}

export interface DoubanCommentsRuntime
  extends FetchPort,
    DoubanConfigPort,
    ChallengeBypassPort {
  cache?: CachePort;
  logger: LoggerPort;
}

export interface DoubanCelebrityWorksRuntime
  extends Pick<ChallengeBypassPort, 'fetchWithVerification'> {
  cache?: CachePort;
  logger: LoggerPort;
}

export interface DoubanResolverRuntime
  extends Pick<ChallengeBypassPort, 'fetchWithVerification'> {
  cache?: CachePort;
  logger: LoggerPort;
}

export interface DoubanRecommendationsRuntime extends FetchPort {
  cache?: CachePort;
  logger: LoggerPort;
}

export interface DoubanDetailsService {
  getById(
    subjectId: string,
    options?: DoubanGetByIdOptions,
  ): Promise<DoubanDetailsResponse>;
  getCacheKey(subjectId: string): string;
  mergeMobileData(
    details: DoubanSubjectDetails,
    mobileData: Pick<DoubanSubjectDetails, 'trailerUrl' | 'backdrop'> | null,
  ): DoubanSubjectDetails;
}

export interface DoubanCommentsService {
  getById(
    subjectId: string,
    options?: DoubanGetCommentsOptions,
  ): Promise<DoubanCommentsResponse>;
  getCacheKey(subjectId: string, options?: DoubanGetCommentsOptions): string;
}

export interface DoubanCelebrityWorksService {
  getByName(
    options: DoubanGetCelebrityWorksOptions,
  ): Promise<DoubanCelebrityWorksResponse>;
  getCacheKey(options: DoubanGetCelebrityWorksOptions): string;
}

export interface DoubanResolverService {
  searchSubjects(
    input: DoubanSearchSubjectsInput,
  ): Promise<DoubanSearchSubjectsResult>;
  resolveSubjectId(
    input: DoubanResolveSubjectInput,
  ): Promise<DoubanResolveSubjectResult>;
  getCacheKey(input: DoubanResolveSubjectInput): string;
}

export interface DoubanRecommendationsService {
  getList(
    options: DoubanGetRecommendationsOptions,
  ): Promise<DoubanRecommendationsResponse>;
  getCacheKey(options: DoubanGetRecommendationsOptions): string;
}
