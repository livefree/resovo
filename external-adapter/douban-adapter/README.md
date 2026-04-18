# douban-adapter

Portable Douban metadata adapter.

Current scope includes:

- `resolver`
- `details`
- `comments`
- `recommendations`
- `celebrity works`

See `PROJECT_PLAN.md` for current phase status and remaining hardening work.
Development progress is tracked in `DEVELOPMENT_LOG.md`.
Release readiness is tracked in `RELEASE_CHECKLIST.md`.

This package focuses on two jobs:

- resolve human-readable metadata into a Douban `subject id`
- fetch normalized Douban data from known ids or list-style endpoints

It includes:

- subject id resolver
- HTML details parsing
- short comments parsing and fetching
- recommendation list fetching
- celebrity works fetching
- anti-crawler verification integration hooks
- cookies support
- optional browser challenge bypass
- Mobile API fallback
- snake_case compatibility output helpers

It does not include:

- complete resolver live-sample hardening
- recommendation search adapter outside the details payload
- frontend UI code

## Installation

```bash
npm install douban-adapter
```

## Quick Start

```ts
import {
  createDoubanDetailsService,
  createDoubanResolverService,
  createHostRuntime,
} from 'douban-adapter';

const runtime = createHostRuntime({
  fetch,
  getDoubanConfig: async () => ({
    cookies: process.env.DOUBAN_COOKIE ?? null,
    enablePuppeteer: false,
  }),
  fetchWithVerification: async (url, init) => fetch(url, init),
  logger: console,
});

const resolver = createDoubanResolverService(runtime);
const details = createDoubanDetailsService(runtime);

const resolved = await resolver.resolveSubjectId({
  title: '肖申克的救赎',
  year: 1994,
  type: 'movie',
});

const result = await details.getById(resolved.chosen!.id);
```

## Public API

Core:

- `createDoubanDetailsService`
- `createDoubanCommentsService`
- `createDoubanResolverService`
- `createDoubanRecommendationsService`
- `createDoubanCelebrityWorksService`
- `getDetailsCacheKey`
- `getCommentsCacheKey`
- `getResolverCacheKey`
- `getRecommendationsCacheKey`
- `getCelebrityWorksCacheKey`
- `mergeMobileDataIntoDetails`
- `parseDoubanDetailsHtml`
- `parseDoubanCommentsHtml`
- `buildSubjectSearchUrl`
- `buildRecommendationsUrl`
- `buildCelebrityWorksUrl`
- `parseSearchPageData`
- `rankCandidates`
- `fetchDetailsFromMobileApi`
- `fetchMobileApiMediaData`
- `DoubanError`

Host integration:

- `createHostRuntime`
- `createDetailsDataFetcher`
- `createSnakeCaseDetailsHandler`
- `toSnakeCaseDetailsResponse`

Helpers:

- `normalizeSubjectId`
- `isDoubanChallengePage`
- `getSubjectPageUrl`
- `getMovieMobileApiUrl`
- `getTvMobileApiUrl`

## Validation

Run package checks:

```bash
npm run typecheck
npm run test
npm run test:live
```

Current built-in tests cover:

- movie HTML path
- tv HTML path
- challenge to Mobile API fallback path
- snake_case compatibility mapping
- resolver exact match path
- resolver ambiguous match path
- comments parser path
- comments service path
- recommendations service path
- celebrity works parser path
- celebrity works service path

## Notes

- The package expects the host to supply network, config, and optional cache or bypass integrations.
- Real Douban traffic can trigger challenge flows. The fallback path is part of the intended design, not an edge case.
- Live-sample validation remains the main unfinished hardening task.
- On `2026-04-04`, live validation passed for `resolver`, `details`, `recommendations`, and `celebrity works`; `comments` was blocked by Douban anti-crawler behavior in the minimal validation runtime.
- For `comments`, hosts should plan to provide valid Douban cookies or a browser-based challenge bypass in stricter environments.
