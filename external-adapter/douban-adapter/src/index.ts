export type {
  DoubanCelebrityWorksMode,
  DoubanCelebrityWorksResponse,
  DoubanCelebrityWorkItem,
  DoubanGetCelebrityWorksOptions,
} from './core/celebrity-works.types.js';
export type {
  DoubanComment,
  DoubanCommentsData,
  DoubanCommentsResponse,
  DoubanGetCommentsOptions,
} from './core/comments.types.js';
export type {
  DoubanCelebrity,
  DoubanDetailsResponse,
  DoubanGetByIdOptions,
  DoubanRecommendation,
  DoubanSubjectDetails,
} from './core/details.types.js';
export {
  createDoubanCelebrityWorksService,
  DEFAULT_CELEBRITY_WORKS_CACHE_TTL_SECONDS,
} from './core/celebrity-works.service.js';
export {
  createDoubanCommentsService,
  DEFAULT_COMMENTS_CACHE_TTL_SECONDS,
} from './core/comments.service.js';
export type {
  DoubanResolveSubjectInput,
  DoubanResolveSubjectResult,
  DoubanResolvedCandidate,
  DoubanSearchSubjectsInput,
  DoubanSearchSubjectsResult,
  DoubanSubjectType,
} from './core/resolver.types.js';
export type {
  DoubanGetRecommendationsOptions,
  DoubanRecommendationItem,
  DoubanRecommendationsResponse,
} from './core/recommendations.types.js';
export {
  buildCelebrityWorksUrl,
  DEFAULT_CELEBRITY_WORKS_LIMIT,
  MAX_CELEBRITY_WORKS_LIMIT,
  getCelebrityWorksCacheKey,
  validateCelebrityWorksRequest,
} from './core/celebrity-works.helpers.js';
export {
  DEFAULT_COMMENTS_LIMIT,
  DEFAULT_COMMENTS_SORT,
  MAX_COMMENTS_LIMIT,
  getCommentsCacheKey,
  getSubjectCommentsUrl,
  validateCommentsRequest,
} from './core/comments.helpers.js';
export {
  createDoubanDetailsService,
  DEFAULT_DETAILS_CACHE_TTL_SECONDS,
  getDetailsCacheKey,
  mergeMobileDataIntoDetails,
} from './core/details.service.js';
export {
  createDoubanRecommendationsService,
  DEFAULT_RECOMMENDATIONS_CACHE_TTL_SECONDS,
} from './core/recommendations.service.js';
export {
  createDoubanResolverService,
  DEFAULT_RESOLVER_CACHE_TTL_SECONDS,
  getResolverCacheKey,
} from './core/resolver.service.js';
export {
  parseDoubanCelebrityWorksHtml,
} from './core/celebrity-works-parser.js';
export {
  parseDoubanCommentsHtml,
} from './core/comments-parser.js';
export {
  getMovieMobileApiUrl,
  getSubjectPageUrl,
  getTvMobileApiUrl,
  isDoubanChallengePage,
  normalizeSubjectId,
} from './core/details.helpers.js';
export {
  buildSubjectSearchUrl,
  getResolveSearchQuery,
  normalizeSearchCandidate,
  parseSearchPageData,
  rankCandidates,
  scoreCandidate,
} from './core/resolver.helpers.js';
export {
  buildRecommendationsUrl,
  DEFAULT_RECOMMENDATIONS_LIMIT,
  MAX_RECOMMENDATIONS_LIMIT,
  getRecommendationsCacheKey,
  validateRecommendationsRequest,
} from './core/recommendations.helpers.js';
export { parseDoubanDetailsHtml } from './core/html-parser.js';
export {
  fetchDetailsFromMobileApi,
  fetchMobileApiMediaData,
} from './core/mobile-api.js';
export { createHostRuntime } from './adapters/host-runtime.js';
export type { HostRuntimeDeps } from './adapters/host-runtime.js';
export { createSnakeCaseDetailsHandler } from './compat/snake-case-entry.js';
export { createDetailsDataFetcher } from './compat/data-fetcher.js';
export {
  toSnakeCaseDetailsResponse,
} from './compat/snake-case-details-response.js';
export type {
  SnakeCaseDoubanDetailsData,
  SnakeCaseDoubanDetailsResponse,
} from './compat/snake-case-details-response.js';
export { DoubanError } from './core/errors.js';
export type { DoubanErrorCode } from './core/errors.js';
export type {
  CachePort,
  ChallengeBypassPort,
  DoubanCelebrityWorksRuntime,
  DoubanCelebrityWorksService,
  DoubanCommentsRuntime,
  DoubanCommentsService,
  DoubanConfigPort,
  DoubanDetailsRuntime,
  DoubanDetailsService,
  DoubanRecommendationsRuntime,
  DoubanRecommendationsService,
  DoubanResolverRuntime,
  DoubanResolverService,
  FetchPort,
  LoggerPort,
} from './ports/runtime.js';
