import type {
  DoubanCelebrityWorksMode,
  DoubanCelebrityWorkItem,
  DoubanCelebrityWorksResponse,
  DoubanGetCelebrityWorksOptions,
} from './celebrity-works.types.js';
import { DoubanError } from './errors.js';
import type {
  DoubanCelebrityWorksRuntime,
  DoubanCelebrityWorksService,
} from '../ports/runtime.js';
import {
  buildCelebrityWorksUrl,
  DEFAULT_CELEBRITY_WORKS_LIMIT,
  getCelebrityWorksCacheKey,
  validateCelebrityWorksRequest,
} from './celebrity-works.helpers.js';
import { parseDoubanCelebrityWorksHtml } from './celebrity-works-parser.js';

const DEFAULT_CELEBRITY_WORKS_CACHE_TTL_SECONDS = 2 * 60 * 60;

interface DoubanCelebrityApiPayload {
  subjects?: Array<{
    id: string;
    title: string;
    cover: string;
    rate?: string;
    url: string;
  }>;
}

interface NormalizedCelebrityWorksOptions
  extends Omit<DoubanGetCelebrityWorksOptions, 'limit' | 'mode'> {
  limit: number;
  mode: DoubanCelebrityWorksMode;
}

function normalizeApiWorks(payload: DoubanCelebrityApiPayload): DoubanCelebrityWorkItem[] {
  return (payload.subjects ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    poster: item.cover,
    rate: item.rate || '',
    url: item.url,
    source: 'douban-api',
  }));
}

export function createDoubanCelebrityWorksService(
  runtime: DoubanCelebrityWorksRuntime,
): DoubanCelebrityWorksService {
  return {
    async getByName(
      options: DoubanGetCelebrityWorksOptions,
    ): Promise<DoubanCelebrityWorksResponse> {
      const normalizedOptions: NormalizedCelebrityWorksOptions = {
        ...options,
        limit: options.limit ?? DEFAULT_CELEBRITY_WORKS_LIMIT,
        mode: options.mode ?? 'search',
      };
      validateCelebrityWorksRequest(normalizedOptions);

      const cacheKey = getCelebrityWorksCacheKey(normalizedOptions);
      if (!normalizedOptions.noCache && runtime.cache) {
        const cached =
          await runtime.cache.get<DoubanCelebrityWorksResponse>(cacheKey);
        if (cached?.works) {
          runtime.logger.info('douban.celebrity_works.cache_hit', {
            name: normalizedOptions.name,
            mode: normalizedOptions.mode,
          });
          return cached;
        }
      }

      const url = buildCelebrityWorksUrl(
        normalizedOptions.name,
        normalizedOptions.mode,
        normalizedOptions.limit,
      );

      const response = await runtime.fetchWithVerification(url, {
        headers:
          normalizedOptions.mode === 'api'
            ? {
                Accept: 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                Referer: 'https://movie.douban.com/',
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
              }
            : {
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
          `Douban celebrity works request failed: ${response.status}`,
          'NETWORK_ERROR',
          response.status,
        );
      }

      const works =
        normalizedOptions.mode === 'api'
          ? normalizeApiWorks((await response.json()) as DoubanCelebrityApiPayload)
          : parseDoubanCelebrityWorksHtml(await response.text()).slice(
              0,
              normalizedOptions.limit,
            );

      const result: DoubanCelebrityWorksResponse = {
        success: true,
        celebrityName: normalizedOptions.name.trim(),
        mode: normalizedOptions.mode,
        works,
        total: works.length,
      };

      if (!normalizedOptions.noCache && runtime.cache) {
        await runtime.cache.set(
          cacheKey,
          result,
          DEFAULT_CELEBRITY_WORKS_CACHE_TTL_SECONDS,
        );
      }

      return result;
    },

    getCacheKey(options: DoubanGetCelebrityWorksOptions): string {
      return getCelebrityWorksCacheKey({
        ...options,
        limit: options.limit ?? DEFAULT_CELEBRITY_WORKS_LIMIT,
        mode: options.mode ?? 'search',
      });
    },
  };
}

export { DEFAULT_CELEBRITY_WORKS_CACHE_TTL_SECONDS };
