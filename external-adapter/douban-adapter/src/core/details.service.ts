import type {
  DoubanDetailsResponse,
  DoubanGetByIdOptions,
  DoubanSubjectDetails,
} from './details.types.js';
import { DoubanError } from './errors.js';
import type {
  DoubanDetailsRuntime,
  DoubanDetailsService,
} from '../ports/runtime.js';
import {
  getSubjectPageUrl,
  isDoubanChallengePage,
  normalizeSubjectId,
} from './details.helpers.js';
import { parseDoubanDetailsHtml } from './html-parser.js';
import {
  fetchDetailsFromMobileApi,
  fetchMobileApiMediaData,
} from './mobile-api.js';

const DEFAULT_DETAILS_CACHE_TTL_SECONDS = 4 * 60 * 60;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const SUBJECT_FETCH_TIMEOUT_MS = 20_000;
const MIN_REQUEST_INTERVAL_MS = 2_000;

let lastRequestTime = 0;

export function getDetailsCacheKey(subjectId: string): string {
  return `douban-details-id=${normalizeSubjectId(subjectId)}`;
}

export function mergeMobileDataIntoDetails(
  details: DoubanSubjectDetails,
  mobileData: Pick<DoubanSubjectDetails, 'trailerUrl' | 'backdrop'> | null,
): DoubanSubjectDetails {
  if (!mobileData) {
    return details;
  }

  return {
    ...details,
    trailerUrl: mobileData.trailerUrl ?? details.trailerUrl,
    backdrop: details.backdrop || mobileData.backdrop,
  };
}

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

function getDirectHtmlRequestHeaders(cookie?: string | null): HeadersInit {
  return {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'max-age=0',
    DNT: '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    Referer: 'https://www.douban.com/',
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function fetchDirectSubjectHtml(
  runtime: DoubanDetailsRuntime,
  subjectUrl: string,
  cookie?: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUBJECT_FETCH_TIMEOUT_MS);

  try {
    return await runtime.fetch(subjectUrl, {
      signal: controller.signal,
      headers: getDirectHtmlRequestHeaders(cookie),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryFetchWithAntiCrawler(
  runtime: DoubanDetailsRuntime,
  subjectUrl: string,
): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    runtime.logger.info('douban.details.anti_crawler.start', {
      subjectUrl,
    });

    const response = await runtime.fetchWithVerification(subjectUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `status=${response.status}`,
      };
    }

    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchAndParseSubjectDetails(
  runtime: DoubanDetailsRuntime,
  subjectId: string,
): Promise<DoubanDetailsResponse> {
  const normalizedId = normalizeSubjectId(subjectId);
  const subjectUrl = getSubjectPageUrl(normalizedId);
  const config = await runtime.getDoubanConfig();

  await waitForRateLimitWindow();

  let html: string | null = null;
  const antiCrawlerResult = await tryFetchWithAntiCrawler(runtime, subjectUrl);
  if (antiCrawlerResult.success && antiCrawlerResult.html) {
    if (!isDoubanChallengePage(antiCrawlerResult.html)) {
      html = antiCrawlerResult.html;
      runtime.logger.info('douban.details.anti_crawler.success', {
        subjectId: normalizedId,
      });
    } else {
      runtime.logger.warn('douban.details.anti_crawler.challenge_page', {
        subjectId: normalizedId,
      });
    }
  } else {
    runtime.logger.warn('douban.details.anti_crawler.failed', {
      subjectId: normalizedId,
      error: antiCrawlerResult.error,
    });
  }

  if (!html) {
    const response = await fetchDirectSubjectHtml(
      runtime,
      subjectUrl,
      config.cookies,
    );

    runtime.logger.info('douban.details.direct_fetch.response', {
      subjectId: normalizedId,
      status: response.status,
      usedCookie: Boolean(config.cookies),
    });

    if (!response.ok) {
      if (
        response.status === 429 ||
        response.status === 302 ||
        response.status === 301
      ) {
        return fetchDetailsFromMobileApi(runtime, normalizedId);
      }

      if (response.status >= 500) {
        throw new DoubanError(
          `Douban server error: ${response.status}`,
          'SERVER_ERROR',
          response.status,
        );
      }

      if (response.status === 404) {
        throw new DoubanError(
          `Subject not found: ${normalizedId}`,
          'SERVER_ERROR',
          404,
        );
      }

      throw new DoubanError(
        `HTTP error: ${response.status}`,
        'NETWORK_ERROR',
        response.status,
      );
    }

    html = await response.text();
    if (isDoubanChallengePage(html)) {
      runtime.logger.warn('douban.details.direct_fetch.challenge_page', {
        subjectId: normalizedId,
        hasBypass: Boolean(runtime.bypassChallenge),
      });

      if (config.enablePuppeteer && runtime.bypassChallenge) {
        try {
          const bypassResult = await runtime.bypassChallenge(subjectUrl);
          html = bypassResult.html;

          if (isDoubanChallengePage(html)) {
            return fetchDetailsFromMobileApi(runtime, normalizedId);
          }
        } catch (error) {
          runtime.logger.warn('douban.details.bypass.failed', {
            subjectId: normalizedId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return fetchDetailsFromMobileApi(runtime, normalizedId);
        }
      } else {
        return fetchDetailsFromMobileApi(runtime, normalizedId);
      }
    }
  }

  const parsed = parseDoubanDetailsHtml(html, normalizedId);
  const mobileData = await fetchMobileApiMediaData(runtime, normalizedId);

  if (parsed.code === 200 && parsed.data) {
    parsed.data = mergeMobileDataIntoDetails(parsed.data, mobileData);
  }

  return parsed;
}

async function getByIdWithRetries(
  runtime: DoubanDetailsRuntime,
  subjectId: string,
  retryCount = 0,
): Promise<DoubanDetailsResponse> {
  try {
    return await fetchAndParseSubjectDetails(runtime, subjectId);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new DoubanError(
        'Douban request timed out',
        'TIMEOUT',
        504,
      );

      if (retryCount < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[retryCount]);
        return getByIdWithRetries(runtime, subjectId, retryCount + 1);
      }

      throw timeoutError;
    }

    if (error instanceof DoubanError) {
      if (
        (error.code === 'RATE_LIMIT' || error.code === 'SERVER_ERROR') &&
        retryCount < MAX_RETRIES
      ) {
        await sleep(RETRY_DELAYS_MS[retryCount]);
        return getByIdWithRetries(runtime, subjectId, retryCount + 1);
      }

      throw error;
    }

    throw new DoubanError(
      error instanceof Error ? error.message : 'Unknown network error',
      'NETWORK_ERROR',
    );
  }
}

export function createDoubanDetailsService(
  runtime: DoubanDetailsRuntime,
): DoubanDetailsService {
  return {
    async getById(
      subjectId: string,
      options: DoubanGetByIdOptions = {},
    ): Promise<DoubanDetailsResponse> {
      const normalizedId = normalizeSubjectId(subjectId);
      const cacheKey = getDetailsCacheKey(normalizedId);

      if (!options.noCache && runtime.cache) {
        const cached = await runtime.cache.get<DoubanDetailsResponse>(cacheKey);
        if (cached?.data?.title) {
          runtime.logger.info('douban.details.cache_hit', {
            subjectId: normalizedId,
          });
          return cached;
        }
      }

      runtime.logger.info('douban.details.fetch_start', {
        subjectId: normalizedId,
        subjectUrl: getSubjectPageUrl(normalizedId),
      });

      const result = await getByIdWithRetries(runtime, normalizedId);

      if (
        !options.noCache &&
        result.code === 200 &&
        result.data?.title &&
        runtime.cache
      ) {
        await runtime.cache.set(
          cacheKey,
          result,
          DEFAULT_DETAILS_CACHE_TTL_SECONDS,
        );
      }

      return result;
    },

    getCacheKey(subjectId: string): string {
      return getDetailsCacheKey(subjectId);
    },

    mergeMobileData(
      details: DoubanSubjectDetails,
      mobileData: Pick<DoubanSubjectDetails, 'trailerUrl' | 'backdrop'> | null,
    ): DoubanSubjectDetails {
      return mergeMobileDataIntoDetails(details, mobileData);
    },
  };
}

export { DEFAULT_DETAILS_CACHE_TTL_SECONDS };
