import type {
  DoubanGetRecommendationsOptions,
  DoubanRecommendationItem,
  DoubanRecommendationsResponse,
} from './recommendations.types.js';
import { DoubanError } from './errors.js';
import type {
  DoubanRecommendationsRuntime,
  DoubanRecommendationsService,
} from '../ports/runtime.js';
import {
  buildRecommendationsUrl,
  DEFAULT_RECOMMENDATIONS_LIMIT,
  getRecommendationsCacheKey,
} from './recommendations.helpers.js';

const DEFAULT_RECOMMENDATIONS_CACHE_TTL_SECONDS = 2 * 60 * 60;

interface DoubanRecommendApiResponse {
  items: Array<{
    id: string;
    title: string;
    year: string;
    type: string;
    pic?: {
      large?: string;
      normal?: string;
    };
    rating?: {
      value?: number;
    };
  }>;
}

function normalizeRecommendations(
  payload: DoubanRecommendApiResponse,
): DoubanRecommendationItem[] {
  return payload.items
    .filter((item) => item.type === 'movie' || item.type === 'tv')
    .map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.year,
      type: item.type as 'movie' | 'tv',
    }));
}

export function createDoubanRecommendationsService(
  runtime: DoubanRecommendationsRuntime,
): DoubanRecommendationsService {
  return {
    async getList(
      options: DoubanGetRecommendationsOptions,
    ): Promise<DoubanRecommendationsResponse> {
      const normalizedOptions: DoubanGetRecommendationsOptions = {
        ...options,
        start: options.start ?? 0,
        limit: options.limit ?? DEFAULT_RECOMMENDATIONS_LIMIT,
      };

      const cacheKey = getRecommendationsCacheKey(normalizedOptions);
      if (!options.noCache && runtime.cache) {
        const cached =
          await runtime.cache.get<DoubanRecommendationsResponse>(cacheKey);
        if (cached?.list?.length) {
          runtime.logger.info('douban.recommendations.cache_hit', {
            kind: normalizedOptions.kind,
          });
          return cached;
        }
      }

      const response = await runtime.fetch(
        buildRecommendationsUrl(normalizedOptions),
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            Referer: 'https://m.douban.com/',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          },
        },
      );

      if (!response.ok) {
        throw new DoubanError(
          `Douban recommendations request failed: ${response.status}`,
          'NETWORK_ERROR',
          response.status,
        );
      }

      const payload = (await response.json()) as DoubanRecommendApiResponse;
      const result: DoubanRecommendationsResponse = {
        code: 200,
        message: '获取成功',
        list: normalizeRecommendations(payload),
      };

      if (!options.noCache && runtime.cache) {
        await runtime.cache.set(
          cacheKey,
          result,
          DEFAULT_RECOMMENDATIONS_CACHE_TTL_SECONDS,
        );
      }

      return result;
    },

    getCacheKey(options: DoubanGetRecommendationsOptions): string {
      return getRecommendationsCacheKey({
        ...options,
        start: options.start ?? 0,
        limit: options.limit ?? DEFAULT_RECOMMENDATIONS_LIMIT,
      });
    },
  };
}

export { DEFAULT_RECOMMENDATIONS_CACHE_TTL_SECONDS };
