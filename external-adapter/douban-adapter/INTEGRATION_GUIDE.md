# Integration Guide

## Required Host Dependencies

Provide these functions when creating a runtime:

- `fetch`
- `getDoubanConfig`
- `fetchWithVerification`
- `logger`

Optional:

- `cache`
- `bypassChallenge`

`getDoubanConfig` must resolve to:

```ts
{
  cookies?: string | null;
  enablePuppeteer?: boolean;
}
```

## Core Runtime Setup

```ts
import {
  createDoubanCelebrityWorksService,
  createDoubanCommentsService,
  createDoubanDetailsService,
  createDoubanRecommendationsService,
  createDoubanResolverService,
  createHostRuntime,
} from 'douban-adapter';

const runtime = createHostRuntime({
  fetch,
  getDoubanConfig,
  fetchWithVerification,
  bypassChallenge,
  cache,
  logger,
});

const detailsService = createDoubanDetailsService(runtime);
const commentsService = createDoubanCommentsService(runtime);
const celebrityWorksService = createDoubanCelebrityWorksService(runtime);
const recommendationsService = createDoubanRecommendationsService(runtime);
const resolverService = createDoubanResolverService(runtime);

const resolved = await resolverService.resolveSubjectId({
  title: '肖申克的救赎',
  year: 1994,
  type: 'movie',
});

const result = await detailsService.getById(resolved.chosen!.id);
const comments = await commentsService.getById(resolved.chosen!.id);
const recommendations = await recommendationsService.getList({
  kind: 'movie',
  category: '剧情',
});
const works = await celebrityWorksService.getByName({
  name: '胡歌',
  mode: 'search',
});
```

## Data-only Fetcher

```ts
import { createDetailsDataFetcher } from 'douban-adapter';

const fetcher = createDetailsDataFetcher({
  fetch,
  getDoubanConfig,
  fetchWithVerification,
  logger,
});

const data = await fetcher.getDataById('1292052');
```

## snake_case Compatibility Output

Use this if the host still expects snake_case response fields.

```ts
import { createSnakeCaseDetailsHandler } from 'douban-adapter';

const handler = createSnakeCaseDetailsHandler({
  fetch,
  getDoubanConfig,
  fetchWithVerification,
  logger,
});

const result = await handler.getById('1292052');
```

## Operational Notes

- Challenge pages can redirect to Douban security endpoints or return 403.
- Mobile API fallback should remain enabled for resilient integrations.
- Resolver is available, but still needs broader live-sample hardening.
- Comments adapter is available for known `subject id` inputs.
- Recommendations adapter is available for Douban list-style discovery flows.
- Celebrity works adapter supports both `search` and `api` modes.
- `npm run test:live` is available for package-level live probing.
- In the `2026-04-04` live run, comments were the only flow blocked by Douban anti-crawler behavior in the minimal runtime.
- In production-like hosts, `comments` should be paired with either valid Douban cookies or a working `bypassChallenge` implementation.
- Use `RELEASE_CHECKLIST.md` before handing the package to another team.
