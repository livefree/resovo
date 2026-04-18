import type {
  DoubanCommentsResponse,
  DoubanGetCommentsOptions,
} from './comments.types.js';
import { DoubanError } from './errors.js';
import type {
  DoubanCommentsRuntime,
  DoubanCommentsService,
} from '../ports/runtime.js';
import {
  DEFAULT_COMMENTS_LIMIT,
  DEFAULT_COMMENTS_SORT,
  getCommentsCacheKey,
  getSubjectCommentsUrl,
  validateCommentsRequest,
} from './comments.helpers.js';
import { isDoubanChallengePage, normalizeSubjectId } from './details.helpers.js';
import { parseDoubanCommentsHtml } from './comments-parser.js';

const DEFAULT_COMMENTS_CACHE_TTL_SECONDS = 2 * 60 * 60;
const COMMENTS_FETCH_TIMEOUT_MS = 15_000;
const MIN_REQUEST_INTERVAL_MS = 2_000;

let lastRequestTime = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimitWindow(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function getCommentsRequestHeaders(cookie?: string | null): HeadersInit {
  return {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    Referer: 'https://movie.douban.com/',
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function tryFetchCommentsWithAntiCrawler(
  runtime: DoubanCommentsRuntime,
  url: string,
): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const response = await runtime.fetchWithVerification(url);
    if (!response.ok) {
      return { success: false, error: `status=${response.status}` };
    }
    return { success: true, html: await response.text() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchDirectCommentsHtml(
  runtime: DoubanCommentsRuntime,
  url: string,
  cookie?: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMMENTS_FETCH_TIMEOUT_MS);

  try {
    return await runtime.fetch(url, {
      signal: controller.signal,
      headers: getCommentsRequestHeaders(cookie),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryBypassCommentsChallenge(
  runtime: DoubanCommentsRuntime,
  url: string,
  enablePuppeteer?: boolean,
): Promise<string | null> {
  if (!enablePuppeteer || !runtime.bypassChallenge) {
    return null;
  }

  const bypassResult = await runtime.bypassChallenge(url);
  return bypassResult.html;
}

export function createDoubanCommentsService(
  runtime: DoubanCommentsRuntime,
): DoubanCommentsService {
  return {
    async getById(
      subjectId: string,
      options: DoubanGetCommentsOptions = {},
    ): Promise<DoubanCommentsResponse> {
      const normalizedId = normalizeSubjectId(subjectId);
      const start = options.start ?? 0;
      const limit = options.limit ?? DEFAULT_COMMENTS_LIMIT;
      const sort = options.sort ?? DEFAULT_COMMENTS_SORT;

      validateCommentsRequest(start, limit);

      const cacheKey = getCommentsCacheKey(normalizedId, start, limit, sort);
      if (!options.noCache && runtime.cache) {
        const cached = await runtime.cache.get<DoubanCommentsResponse>(cacheKey);
        if (cached?.data) {
          runtime.logger.info('douban.comments.cache_hit', {
            subjectId: normalizedId,
            start,
            limit,
            sort,
          });
          return cached;
        }
      }

      const target = getSubjectCommentsUrl(normalizedId, start, limit, sort);
      const config = await runtime.getDoubanConfig();

      await waitForRateLimitWindow();

      let html: string | null = null;
      const antiCrawlerResult = await tryFetchCommentsWithAntiCrawler(runtime, target);
      if (antiCrawlerResult.success && antiCrawlerResult.html) {
        if (!isDoubanChallengePage(antiCrawlerResult.html)) {
          html = antiCrawlerResult.html;
        } else {
          html = await tryBypassCommentsChallenge(
            runtime,
            target,
            config.enablePuppeteer,
          );
        }
      }

      if (!html) {
        const response = await fetchDirectCommentsHtml(runtime, target, config.cookies);

        if (!response.ok) {
          if (response.status >= 500) {
            throw new DoubanError(
              `Douban comments server error: ${response.status}`,
              'SERVER_ERROR',
              response.status,
            );
          }

          throw new DoubanError(
            `Douban comments request failed: ${response.status}`,
            'NETWORK_ERROR',
            response.status,
          );
        }

        html = await response.text();

        if (isDoubanChallengePage(html)) {
          const bypassedHtml = await tryBypassCommentsChallenge(
            runtime,
            target,
            config.enablePuppeteer,
          );

          if (bypassedHtml) {
            html = bypassedHtml;
          } else {
            throw new DoubanError(
              'Douban anti-crawler challenge blocks comments access',
              'NETWORK_ERROR',
              403,
            );
          }
        }
      }

      if (isDoubanChallengePage(html)) {
        throw new DoubanError(
          'Unable to bypass Douban anti-crawler challenge for comments',
          'NETWORK_ERROR',
          403,
        );
      }

      const comments = parseDoubanCommentsHtml(html);
      const result: DoubanCommentsResponse = {
        code: 200,
        message: '获取成功',
        data: {
          comments,
          start,
          limit,
          count: comments.length,
        },
      };

      if (!options.noCache && runtime.cache) {
        await runtime.cache.set(
          cacheKey,
          result,
          DEFAULT_COMMENTS_CACHE_TTL_SECONDS,
        );
      }

      return result;
    },

    getCacheKey(
      subjectId: string,
      options: DoubanGetCommentsOptions = {},
    ): string {
      return getCommentsCacheKey(
        subjectId,
        options.start ?? 0,
        options.limit ?? DEFAULT_COMMENTS_LIMIT,
        options.sort ?? DEFAULT_COMMENTS_SORT,
      );
    },
  };
}

export { DEFAULT_COMMENTS_CACHE_TTL_SECONDS };
