import { performance } from 'node:perf_hooks';
import {
  createDoubanCelebrityWorksService,
  createDoubanCommentsService,
  createDoubanDetailsService,
  createDoubanRecommendationsService,
  createDoubanResolverService,
  createHostRuntime,
} from '../dist/index.js';

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function summarizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

async function runCheck(name, fn) {
  const startedAt = performance.now();

  try {
    const data = await fn();
    return {
      name,
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      data,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: summarizeError(error),
    };
  }
}

function printResult(result) {
  if (result.ok) {
    console.log(`PASS ${result.name} (${result.durationMs}ms)`);
    console.log(JSON.stringify(result.data, null, 2));
    return;
  }

  console.log(`FAIL ${result.name} (${result.durationMs}ms)`);
  console.log(JSON.stringify(result.error, null, 2));
}

async function main() {
  const runtime = createHostRuntime({
    fetch: globalThis.fetch,
    getDoubanConfig: async () => ({
      cookies: process.env.DOUBAN_COOKIE ?? null,
      enablePuppeteer: false,
    }),
    fetchWithVerification: async (url, init) => fetch(url, init),
    logger: createLogger(),
  });

  const details = createDoubanDetailsService(runtime);
  const comments = createDoubanCommentsService(runtime);
  const recommendations = createDoubanRecommendationsService(runtime);
  const resolver = createDoubanResolverService(runtime);
  const celebrityWorks = createDoubanCelebrityWorksService({
    fetchWithVerification: async (url, init) => fetch(url, init),
    logger: createLogger(),
  });

  const results = [];
  let resolvedMovieId = '1292052';
  let resolvedTvId = '35490175';

  results.push(
    await runCheck('resolver:shawshank', async () => {
      const result = await resolver.resolveSubjectId({
        title: '肖申克的救赎',
        year: 1994,
        type: 'movie',
        aliases: ['The Shawshank Redemption'],
      });

      resolvedMovieId = result.chosen?.id ?? resolvedMovieId;

      return {
        chosenId: resolvedMovieId,
        chosenTitle: result.chosen?.title ?? null,
        candidateCount: result.candidates.length,
      };
    }),
  );

  results.push(
    await runCheck('resolver:blossoms', async () => {
      const result = await resolver.resolveSubjectId({
        title: '繁花',
        year: 2023,
        type: 'tv',
        actors: ['胡歌'],
      });

      resolvedTvId = result.chosen?.id ?? resolvedTvId;

      return {
        chosenId: resolvedTvId,
        chosenTitle: result.chosen?.title ?? null,
        candidateCount: result.candidates.length,
      };
    }),
  );

  results.push(
    await runCheck('details:movie:1292052', async () => {
      const result = await details.getById(resolvedMovieId, { noCache: true });
      return {
        code: result.code,
        subjectId: resolvedMovieId,
        title: result.data?.title ?? null,
        year: result.data?.year ?? null,
        rate: result.data?.rate ?? null,
      };
    }),
  );

  results.push(
    await runCheck('details:tv:resolved', async () => {
      const result = await details.getById(resolvedTvId, { noCache: true });
      return {
        code: result.code,
        subjectId: resolvedTvId,
        title: result.data?.title ?? null,
        episodes: result.data?.episodes ?? null,
      };
    }),
  );

  results.push(
    await runCheck('comments:movie:1292052', async () => {
      const result = await comments.getById('1292052', {
        start: 0,
        limit: 5,
        sort: 'new_score',
        noCache: true,
      });

      return {
        code: result.code,
        count: result.data?.count ?? 0,
        firstUser: result.data?.comments[0]?.username ?? null,
      };
    }),
  );

  results.push(
    await runCheck('recommendations:movie', async () => {
      const result = await recommendations.getList({
        kind: 'movie',
        category: '剧情',
        limit: 5,
        start: 0,
        noCache: true,
      });

      return {
        code: result.code,
        count: result.list.length,
        firstTitle: result.list[0]?.title ?? null,
      };
    }),
  );

  results.push(
    await runCheck('celebrity-works:search:胡歌', async () => {
      const result = await celebrityWorks.getByName({
        name: '胡歌',
        mode: 'search',
        limit: 5,
        noCache: true,
      });

      return {
        success: result.success,
        total: result.total,
        firstTitle: result.works[0]?.title ?? null,
      };
    }),
  );

  results.push(
    await runCheck('celebrity-works:api:娜塔莉·波特曼', async () => {
      const result = await celebrityWorks.getByName({
        name: '娜塔莉·波特曼',
        mode: 'api',
        limit: 5,
        noCache: true,
      });

      return {
        success: result.success,
        total: result.total,
        firstTitle: result.works[0]?.title ?? null,
      };
    }),
  );

  console.log('== douban-adapter live validation ==');
  for (const result of results) {
    printResult(result);
  }

  const failedCount = results.filter((result) => !result.ok).length;
  console.log(`Summary: ${results.length - failedCount}/${results.length} checks passed`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

await main();
