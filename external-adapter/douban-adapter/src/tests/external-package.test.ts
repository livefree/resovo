import test from 'node:test';
import assert from 'node:assert/strict';

import { createDoubanCelebrityWorksService } from '../core/celebrity-works.service.js';
import { parseDoubanCelebrityWorksHtml } from '../core/celebrity-works-parser.js';
import { createDoubanCommentsService } from '../core/comments.service.js';
import { createDoubanDetailsService } from '../core/details.service.js';
import { createDoubanRecommendationsService } from '../core/recommendations.service.js';
import { createDoubanResolverService } from '../core/resolver.service.js';
import { parseDoubanCommentsHtml } from '../core/comments-parser.js';
import { createHostRuntime } from '../adapters/host-runtime.js';
import { toSnakeCaseDetailsResponse } from '../compat/snake-case-details-response.js';
import {
  ANIME_MOBILE_API_DATA,
  ANIME_SUBJECT_ID,
  CELEBRITY_WORKS_API_DATA,
  CELEBRITY_WORKS_SEARCH_HTML,
  CHALLENGE_HTML,
  COMMENTS_HTML,
  MOVIE_DETAILS_HTML,
  MOVIE_MOBILE_API_DATA,
  MOVIE_SUBJECT_ID,
  RECOMMENDATIONS_API_DATA,
  SUBJECT_SEARCH_HTML,
  TV_DETAILS_HTML,
  TV_MOBILE_API_DATA,
  TV_SUBJECT_ID,
} from './fixtures/details-fixture.js';

function createTestRuntime() {
  return createHostRuntime({
    fetch: (async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes(`m.douban.com/rexxar/api/v2/movie/${MOVIE_SUBJECT_ID}`)) {
        return new Response(JSON.stringify(MOVIE_MOBILE_API_DATA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes(`m.douban.com/rexxar/api/v2/movie/${TV_SUBJECT_ID}`)) {
        return new Response(null, { status: 302 });
      }

      if (url.includes(`m.douban.com/rexxar/api/v2/tv/${TV_SUBJECT_ID}`)) {
        return new Response(JSON.stringify(TV_MOBILE_API_DATA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes(`https://movie.douban.com/subject/${ANIME_SUBJECT_ID}/`)) {
        return new Response(CHALLENGE_HTML, { status: 200 });
      }

      if (url.includes(`m.douban.com/rexxar/api/v2/movie/${ANIME_SUBJECT_ID}`)) {
        return new Response(null, { status: 302 });
      }

      if (url.includes(`/subject/${MOVIE_SUBJECT_ID}/comments?`)) {
        return new Response(COMMENTS_HTML, { status: 200 });
      }

      if (url.includes('/rexxar/api/v2/movie/recommend?')) {
        return new Response(JSON.stringify(RECOMMENDATIONS_API_DATA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes(`m.douban.com/rexxar/api/v2/tv/${ANIME_SUBJECT_ID}`)) {
        return new Response(JSON.stringify(ANIME_MOBILE_API_DATA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof globalThis.fetch,
    getDoubanConfig: async () => ({
      cookies: null,
      enablePuppeteer: false,
    }),
    fetchWithVerification: async (url: string) => {
      if (url.includes('/movie/subject_search?')) {
        return new Response(SUBJECT_SEARCH_HTML, { status: 200 });
      }
      if (url.includes(`/subject/${MOVIE_SUBJECT_ID}/comments?`)) {
        return new Response(COMMENTS_HTML, { status: 200 });
      }
      if (url.includes(`/${TV_SUBJECT_ID}/`)) {
        return new Response(TV_DETAILS_HTML, { status: 200 });
      }
      if (url.includes(`/${ANIME_SUBJECT_ID}/`)) {
        return new Response(CHALLENGE_HTML, { status: 200 });
      }
      return new Response(MOVIE_DETAILS_HTML, { status: 200 });
    },
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
  });
}

function createCelebrityRuntime() {
  return {
    cache: undefined,
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
    fetchWithVerification: async (url: string) => {
      if (url.includes('/j/search_subjects?')) {
        return new Response(JSON.stringify(CELEBRITY_WORKS_API_DATA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(CELEBRITY_WORKS_SEARCH_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    },
  };
}

test('service resolves movie subject details', async () => {
  const service = createDoubanDetailsService(createTestRuntime());
  const result = await service.getById(MOVIE_SUBJECT_ID, { noCache: true });

  assert.equal(result.code, 200);
  assert.equal(result.data?.title, '肖申克的救赎');
  assert.equal(result.data?.movieDuration, 142);
});

test('service resolves tv subject details', async () => {
  const service = createDoubanDetailsService(createTestRuntime());
  const result = await service.getById(TV_SUBJECT_ID, { noCache: true });

  assert.equal(result.code, 200);
  assert.equal(result.data?.title, '繁花');
  assert.equal(result.data?.episodes, 30);
  assert.equal(result.data?.episodeLength, 45);
});

test('service falls back from challenge page to mobile api', async () => {
  const service = createDoubanDetailsService(createTestRuntime());
  const result = await service.getById(ANIME_SUBJECT_ID, { noCache: true });

  assert.equal(result.code, 200);
  assert.equal(result.message, '获取成功（使用 Mobile API）');
  assert.equal(result.data?.title, '葬送的芙莉莲');
  assert.equal(result.data?.episodes, 28);
});

test('snake_case compatibility formatter maps camelCase fields', async () => {
  const service = createDoubanDetailsService(createTestRuntime());
  const result = await service.getById(TV_SUBJECT_ID, { noCache: true });
  const snake = toSnakeCaseDetailsResponse(result);

  assert.equal(snake.code, 200);
  assert.equal(snake.data?.episode_length, 45);
  assert.equal(snake.data?.first_aired, '2023-12-27');
});

test('resolver returns ranked candidates for ambiguous subject matches', async () => {
  const resolver = createDoubanResolverService(createTestRuntime());
  const result = await resolver.searchSubjects({
    query: '繁花',
    year: 2023,
    type: 'tv',
    actors: ['胡歌'],
  });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0]?.id, '30444960');
  assert.equal(result.candidates[0]?.type, 'tv');
  assert.ok((result.candidates[0]?.score ?? 0) > (result.candidates[1]?.score ?? 0));
});

test('resolver selects a stable chosen subject id', async () => {
  const resolver = createDoubanResolverService(createTestRuntime());
  const result = await resolver.resolveSubjectId({
    title: '肖申克的救赎',
    year: 1994,
    type: 'movie',
    aliases: ['The Shawshank Redemption'],
    actors: ['摩根·弗里曼'],
  });

  assert.equal(result.chosen?.id, MOVIE_SUBJECT_ID);
  assert.equal(result.chosen?.title, '肖申克的救赎');
  assert.ok((result.chosen?.score ?? 0) >= 100);
});

test('comments parser extracts structured short comments', () => {
  const comments = parseDoubanCommentsHtml(COMMENTS_HTML);

  assert.equal(comments.length, 2);
  assert.equal(comments[0]?.username, '影迷甲');
  assert.equal(comments[0]?.userId, 'cookieuser');
  assert.equal(comments[0]?.avatar, 'https://img1.doubanio.com/icon/u1000001-1.jpg');
  assert.equal(comments[0]?.rating, 5);
  assert.equal(comments[0]?.content, '第一条短评\n换行内容');
  assert.equal(comments[0]?.usefulCount, 128);
});

test('comments service returns normalized short comments for a subject id', async () => {
  const service = createDoubanCommentsService(createTestRuntime());
  const result = await service.getById(MOVIE_SUBJECT_ID, {
    start: 0,
    limit: 10,
    sort: 'new_score',
    noCache: true,
  });

  assert.equal(result.code, 200);
  assert.equal(result.data?.count, 2);
  assert.equal(result.data?.comments[1]?.username, '影迷乙');
  assert.equal(result.data?.comments[1]?.rating, 4);
  assert.equal(result.data?.comments[1]?.location, '');
});

test('comments service can bypass challenge when runtime provides browser bypass', async () => {
  const runtime = createHostRuntime({
    fetch: (async () => new Response(CHALLENGE_HTML, { status: 200 })) as typeof globalThis.fetch,
    getDoubanConfig: async () => ({
      cookies: null,
      enablePuppeteer: true,
    }),
    fetchWithVerification: async () => new Response(CHALLENGE_HTML, { status: 200 }),
    bypassChallenge: async () => ({
      html: COMMENTS_HTML,
      cookies: [],
    }),
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
  });

  const service = createDoubanCommentsService(runtime);
  const result = await service.getById(MOVIE_SUBJECT_ID, {
    noCache: true,
  });

  assert.equal(result.code, 200);
  assert.equal(result.data?.count, 2);
  assert.equal(result.data?.comments[0]?.username, '影迷甲');
});

test('recommendations service returns normalized recommendation list', async () => {
  const service = createDoubanRecommendationsService(createTestRuntime());
  const result = await service.getList({
    kind: 'movie',
    limit: 20,
    start: 0,
    category: '剧情',
    year: '1994',
    noCache: true,
  });

  assert.equal(result.code, 200);
  assert.equal(result.list.length, 2);
  assert.equal(result.list[0]?.id, '1295644');
  assert.equal(result.list[0]?.rate, '9.4');
  assert.equal(result.list[1]?.type, 'movie');
});

test('celebrity works parser extracts works from search html', () => {
  const works = parseDoubanCelebrityWorksHtml(CELEBRITY_WORKS_SEARCH_HTML);

  assert.equal(works.length, 2);
  assert.equal(works[0]?.id, '27119724');
  assert.equal(works[0]?.title, '漫长的季节');
  assert.equal(works[1]?.rate, '8.7');
});

test('celebrity works service supports search mode', async () => {
  const service = createDoubanCelebrityWorksService(createCelebrityRuntime());
  const result = await service.getByName({
    name: '胡歌',
    mode: 'search',
    limit: 20,
    noCache: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'search');
  assert.equal(result.total, 2);
  assert.equal(result.works[0]?.title, '漫长的季节');
});

test('celebrity works service supports api mode', async () => {
  const service = createDoubanCelebrityWorksService(createCelebrityRuntime());
  const result = await service.getByName({
    name: '娜塔莉·波特曼',
    mode: 'api',
    limit: 20,
    noCache: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'api');
  assert.equal(result.total, 2);
  assert.equal(result.works[0]?.id, '1295644');
  assert.equal(result.works[1]?.source, 'douban-api');
});
