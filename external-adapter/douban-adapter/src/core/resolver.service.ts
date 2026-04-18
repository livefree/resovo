import { DoubanError } from './errors.js';
import {
  buildSubjectSearchUrl,
  getResolveSearchQuery,
  normalizeSearchCandidate,
  parseSearchPageData,
  rankCandidates,
} from './resolver.helpers.js';
import type {
  DoubanResolveSubjectInput,
  DoubanResolvedCandidate,
  DoubanResolveSubjectResult,
  DoubanSearchSubjectsInput,
  DoubanSearchSubjectsResult,
} from './resolver.types.js';
import type { DoubanResolverRuntime, DoubanResolverService } from '../ports/runtime.js';

const DEFAULT_RESOLVER_CACHE_TTL_SECONDS = 2 * 60 * 60;

export function getResolverCacheKey(
  input: DoubanResolveSubjectInput,
): string {
  const aliasKey = (input.aliases ?? []).join('|');
  const actorKey = (input.actors ?? []).join('|');
  return `douban-resolver:title=${input.title.trim()}&year=${input.year ?? ''}&type=${input.type ?? ''}&aliases=${aliasKey}&actors=${actorKey}`;
}

async function fetchSearchHtml(
  runtime: DoubanResolverRuntime,
  query: string,
): Promise<string> {
  const response = await runtime.fetchWithVerification(buildSubjectSearchUrl(query), {
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: 'https://www.douban.com/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new DoubanError(
      `Subject search failed with status ${response.status}`,
      'NETWORK_ERROR',
      response.status,
    );
  }

  return response.text();
}

function toResolveInput(
  input: DoubanSearchSubjectsInput | DoubanResolveSubjectInput,
): DoubanResolveSubjectInput {
  const title = 'query' in input ? input.query : input.title;
  return {
    title,
    year: input.year,
    type: input.type,
    aliases: input.aliases,
    actors: input.actors,
  };
}

function isResolvedCandidate(
  candidate: DoubanResolvedCandidate | null,
): candidate is DoubanResolvedCandidate {
  return candidate !== null;
}

export function createDoubanResolverService(
  runtime: DoubanResolverRuntime,
): DoubanResolverService {
  return {
    async searchSubjects(
      input: DoubanSearchSubjectsInput,
    ): Promise<DoubanSearchSubjectsResult> {
      const resolveInput = toResolveInput(input);
      const query = getResolveSearchQuery(resolveInput);
      const html = await fetchSearchHtml(runtime, query);
      const rawItems = parseSearchPageData(html);
      const candidates = rankCandidates(
        resolveInput,
        rawItems.map(normalizeSearchCandidate).filter(isResolvedCandidate),
      );

      runtime.logger.info('douban.resolver.search.complete', {
        query,
        candidateCount: candidates.length,
      });

      return {
        query,
        candidates,
      };
    },

    async resolveSubjectId(
      input: DoubanResolveSubjectInput,
    ): Promise<DoubanResolveSubjectResult> {
      if (!input.title?.trim()) {
        throw new DoubanError('Resolver title is required', 'PARSE_ERROR', 400);
      }

      const cacheKey = getResolverCacheKey(input);
      if (runtime.cache) {
        const cached =
          await runtime.cache.get<DoubanResolveSubjectResult>(cacheKey);
        if (cached?.chosen || cached?.candidates?.length) {
          runtime.logger.info('douban.resolver.cache_hit', {
            title: input.title,
          });
          return cached;
        }
      }

      const searchResult = await this.searchSubjects({
        query: input.title,
        year: input.year,
        type: input.type,
        aliases: input.aliases,
        actors: input.actors,
      });

      const result: DoubanResolveSubjectResult = {
        query: searchResult.query,
        chosen: searchResult.candidates[0] ?? null,
        candidates: searchResult.candidates,
      };

      if (runtime.cache && result.candidates.length > 0) {
        await runtime.cache.set(
          cacheKey,
          result,
          DEFAULT_RESOLVER_CACHE_TTL_SECONDS,
        );
      }

      return result;
    },

    getCacheKey(input: DoubanResolveSubjectInput): string {
      return getResolverCacheKey(input);
    },
  };
}

export { DEFAULT_RESOLVER_CACHE_TTL_SECONDS };
