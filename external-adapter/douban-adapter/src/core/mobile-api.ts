import type {
  DoubanDetailsResponse,
  DoubanMobileApiMediaData,
  DoubanSubjectDetails,
} from './details.types.js';
import { DoubanError } from './errors.js';
import {
  getMovieMobileApiUrl,
  getTvMobileApiUrl,
  normalizeSubjectId,
} from './details.helpers.js';
import type { DoubanDetailsRuntime } from '../ports/runtime.js';

const MOBILE_API_TIMEOUT_MS = 15_000;
const DEFAULT_MOBILE_API_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Referer: 'https://movie.douban.com/explore',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Origin: 'https://movie.douban.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
};

interface DoubanMobileApiResponse {
  id: string;
  title: string;
  year?: string;
  is_tv?: boolean;
  episodes_count?: number;
  episodes_info?: string;
  intro?: string;
  genres?: string[];
  countries?: string[];
  languages?: string[];
  durations?: string[];
  pubdate?: string[];
  directors?: Array<{ name?: string }>;
  actors?: Array<{
    id?: string;
    name?: string;
    avatar?: {
      small?: string;
      normal?: string;
      large?: string;
    };
  }>;
  rating?: {
    value?: number;
  };
  pic?: {
    normal?: string;
    large?: string;
  };
  cover?: {
    image?: {
      raw?: { url?: string };
      large?: { url?: string };
      normal?: { url?: string };
    };
  };
  trailers?: Array<{
    video_url?: string;
  }>;
}

async function fetchMobileApiJson(
  runtime: DoubanDetailsRuntime,
  url: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MOBILE_API_TIMEOUT_MS);

  try {
    const response = await runtime.fetch(url, {
      signal: controller.signal,
      headers: DEFAULT_MOBILE_API_HEADERS,
      redirect: 'manual',
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMovieThenTv(
  runtime: DoubanDetailsRuntime,
  subjectId: string,
): Promise<DoubanMobileApiResponse> {
  const normalizedId = normalizeSubjectId(subjectId);

  let response = await fetchMobileApiJson(
    runtime,
    getMovieMobileApiUrl(normalizedId),
  );

  runtime.logger.info('douban.mobile_api.response', {
    subjectId: normalizedId,
    endpoint: 'movie',
    status: response.status,
  });

  if (response.status >= 300 && response.status < 400) {
    response = await fetchMobileApiJson(runtime, getTvMobileApiUrl(normalizedId));

    runtime.logger.info('douban.mobile_api.response', {
      subjectId: normalizedId,
      endpoint: 'tv',
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new DoubanError(
      `Mobile API returned ${response.status}`,
      'SERVER_ERROR',
      response.status,
    );
  }

  return (await response.json()) as DoubanMobileApiResponse;
}

function extractDurationInfo(data: DoubanMobileApiResponse): {
  episodes?: number;
  episodeLength?: number;
  movieDuration?: number;
} {
  const durationStr = data.durations?.[0] || '';
  const durationMatch = durationStr.match(/(\d+)/);
  const movieDuration = durationMatch ? parseInt(durationMatch[1], 10) : 0;

  const episodes = data.episodes_count || 0;

  let episodeLength = 0;
  if (data.episodes_info) {
    const episodeLengthMatch = data.episodes_info.match(/(\d+)/);
    if (episodeLengthMatch) {
      episodeLength = parseInt(episodeLengthMatch[1], 10);
    }
  }

  if (!episodeLength && durationMatch && data.is_tv) {
    episodeLength = parseInt(durationMatch[1], 10);
  }

  return {
    ...(episodes > 0 ? { episodes } : {}),
    ...(episodeLength > 0 ? { episodeLength } : {}),
    ...(movieDuration > 0 ? { movieDuration } : {}),
  };
}

function toSubjectDetails(data: DoubanMobileApiResponse): DoubanSubjectDetails {
  const celebrities =
    data.actors?.slice(0, 10).map((actor, index) => ({
      id: actor.id || `actor-${index}`,
      name: actor.name || '',
      avatar: actor.avatar?.large || actor.avatar?.normal || '',
      role: '演员',
      avatars: actor.avatar
        ? {
            small: actor.avatar.small || '',
            medium: actor.avatar.normal || '',
            large: actor.avatar.large || '',
          }
        : undefined,
    })) || [];

  return {
    id: data.id,
    title: data.title,
    poster: data.pic?.large || data.pic?.normal || '',
    rate: data.rating?.value ? data.rating.value.toFixed(1) : '0.0',
    year: data.year || '',
    directors: data.directors?.map((director) => director.name || '').filter(Boolean) || [],
    screenwriters: [],
    cast: data.actors?.map((actor) => actor.name || '').filter(Boolean) || [],
    genres: data.genres || [],
    countries: data.countries || [],
    languages: data.languages || [],
    ...extractDurationInfo(data),
    firstAired: data.pubdate?.[0] || '',
    plotSummary: data.intro || '',
    celebrities,
    recommendations: [],
    actors: celebrities,
    backdrop: data.pic?.large || '',
    trailerUrl: data.trailers?.[0]?.video_url || '',
  };
}

function normalizeBackdrop(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url
    .replace('/view/photo/s/', '/view/photo/l/')
    .replace('/view/photo/m/', '/view/photo/l/')
    .replace('/view/photo/sqxs/', '/view/photo/l/')
    .replace('/s_ratio_poster/', '/l_ratio_poster/')
    .replace('/m_ratio_poster/', '/l_ratio_poster/');
}

export async function fetchDetailsFromMobileApi(
  runtime: DoubanDetailsRuntime,
  subjectId: string,
): Promise<DoubanDetailsResponse> {
  const normalizedId = normalizeSubjectId(subjectId);

  try {
    runtime.logger.info('douban.mobile_api.fetch_details.start', {
      subjectId: normalizedId,
    });

    const data = await fetchMovieThenTv(runtime, normalizedId);

    runtime.logger.info('douban.mobile_api.fetch_details.success', {
      subjectId: normalizedId,
      title: data.title,
      isTv: data.is_tv ?? false,
      episodesCount: data.episodes_count || 0,
    });

    return {
      code: 200,
      message: '获取成功（使用 Mobile API）',
      data: toSubjectDetails(data),
    };
  } catch (error) {
    runtime.logger.error('douban.mobile_api.fetch_details.failed', {
      subjectId: normalizedId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new DoubanError(
      'Mobile API fetch failed',
      'SERVER_ERROR',
      500,
    );
  }
}

export async function fetchMobileApiMediaData(
  runtime: DoubanDetailsRuntime,
  subjectId: string,
): Promise<DoubanMobileApiMediaData | null> {
  const normalizedId = normalizeSubjectId(subjectId);

  try {
    const data = await fetchMovieThenTv(runtime, normalizedId);

    const backdrop =
      data.cover?.image?.raw?.url ||
      data.cover?.image?.large?.url ||
      data.cover?.image?.normal?.url ||
      data.pic?.large;

    return {
      trailerUrl: data.trailers?.[0]?.video_url || undefined,
      backdrop: normalizeBackdrop(backdrop),
    };
  } catch (error) {
    runtime.logger.warn('douban.mobile_api.fetch_media.failed', {
      subjectId: normalizedId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return null;
  }
}
