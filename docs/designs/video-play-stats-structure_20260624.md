> status: active
> owner: @engineering
> scope: video-level play count statistics, anonymous play events, aggregation, hot ranking, and analytics
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-24

# Video Play Stats Structure

## Context

Resovo currently has no video-level play count statistics. `lists.view_count` exists for lists, but `videos` has no equivalent `view_count`, `play_count`, or internal popularity field. `watch_history` is login-bound (`user_id NOT NULL`) and cannot represent anonymous play volume. Existing `POST /feedback/playback` is a source-health signal for `video_sources` and `source_health_events`; it must not be reused as video-level play count truth.

This design combines two prior proposals:

- Keep the ADR/task-flow discipline from `~/.claude/plans/melodic-petting-biscuit.md`: explicit schema plan, review gates, task splitting, and `architecture.md` synchronization.
- Keep the stricter runtime contract from the Codex review: idempotent event writes, replay-safe aggregation, hourly + daily buckets, main `PlayerShell` integration, and search hot-sort synchronization.

The feature must satisfy all three product uses:

1. Frontend display: show cumulative play count on cards/detail/watch pages.
2. Hot ranking: replace placeholder source-count/rating-votes popularity with internal play heat where applicable.
3. Admin analytics: provide trend lines, top videos, anonymous/logged-in split, and watch-time aggregates.

Anonymous users are first-class. Counting only logged-in users is invalid for Resovo because videos can be played anonymously.

## Current Facts

- Public watch page uses `apps/web-next/src/components/player/PlayerShell.tsx`.
- `PlayerShell` already has `previewMode` write suppression and a `view_count` placeholder comment; this is the primary frontend insertion point.
- Mini-player logic also has `handleVideoPlay` and throttled `handleVideoTimeUpdate`, but it is a secondary insertion point.
- `/videos?sort=hot` currently sorts by active source count in `apps/api/src/db/queries/videos.ts`.
- `/videos/trending` currently uses `v.updated_at` recency, not play events.
- `/search?sort=hot` currently sorts Elasticsearch by `rating_votes`, so search hot-sort needs ES field synchronization.
- Latest migration is `127_video_sources_audio_language_index.sql`; first stats migration should start at `128`.
- Schema changes must update `docs/architecture.md`.

## Design Principles

- Event table is the append-only/replayable truth.
- Aggregates are derived and can be rebuilt.
- Public write path stays light: validate, rate-limit, insert idempotently, return `202`.
- Aggregation is batched, transactional, and retry-safe.
- Public unauthenticated path must not access `users`.
- Exact cumulative play count is preferred over sampling for the first version.
- Privacy-sensitive raw IP/User-Agent is never stored.

## Metric Semantics

### Qualified Play

A `qualified_play` event is counted when a real frontend player session reaches either:

- at least 20 seconds of playback; or
- for short media, at least 80% of known duration.

The exact threshold constants should live in one shared frontend helper and one API schema/service constant. They must not be spread across components.

Do not count:

- admin preview (`previewMode=true`);
- player initialization without playback;
- source switching by itself;
- retries before the threshold;
- repeated reports for the same `play_session_id + video_id + episode_number`.

### Identity Dimensions

- `play_session_id`: frontend-generated random ID scoped to a playback session.
- `visitor_hash`: HMAC/hash of an anonymous visitor cookie. It is stable enough for daily UV and anti-repeat logic, but not reversible.
- `ip_hash`: short hash from `request.ip`, used only for rate-limit/abuse analysis.
- `user_id`: optional future authenticated dimension. Public unauthenticated route must not query `users`; it may only use a user id already provided by an optional auth context if a later ADR allows it.

Cookie ownership must be explicit in the ADR. Recommended v1: one web/API middleware signs or refreshes the anonymous visitor cookie and the play-event write path only consumes the resulting value. If cookies are unavailable, the service may fall back to a request-scoped visitor hash for rate-limit safety, but those events must not inflate daily UV as if they were stable visitors.

## Schema Draft

### `video_play_events`

Append-only event truth. It stores qualified plays only, not every timeupdate.

```sql
CREATE TABLE IF NOT EXISTS video_play_events (
  id                BIGSERIAL PRIMARY KEY,
  idempotency_key   TEXT NOT NULL UNIQUE,

  video_id          UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  source_id         UUID NULL REFERENCES video_sources(id) ON DELETE SET NULL,
  episode_number    INT NULL,

  event_type        TEXT NOT NULL DEFAULT 'qualified_play'
                    CHECK (event_type IN ('qualified_play')),
  play_session_id   TEXT NOT NULL,

  visitor_hash      TEXT NOT NULL,
  ip_hash           TEXT NULL,
  user_id           UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  watch_seconds     INT NOT NULL CHECK (watch_seconds >= 0),
  duration_seconds  INT NULL CHECK (duration_seconds IS NULL OR duration_seconds > 0),

  locale            TEXT NULL,
  referrer_path     TEXT NULL,
  user_agent_hash   TEXT NULL,

  occurred_at       TIMESTAMPTZ NOT NULL,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aggregated_at     TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_video_play_events_pending
  ON video_play_events (ingested_at)
  WHERE aggregated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_video_play_events_video_time
  ON video_play_events (video_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_play_events_occurred_at
  ON video_play_events (occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_play_events_session_video_episode
  ON video_play_events (play_session_id, video_id, COALESCE(episode_number, 0));
```

Idempotency invariant:

- one frontend qualified play attempt maps to one deterministic `idempotency_key`;
- `idempotency_key` must be derived from stable fields, not randomly generated per retry;
- v1 formula should include at least `play_session_id + video_id + episode_number + event_type`;
- API uses `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`;
- DB also enforces a null-safe unique index on `(play_session_id, video_id, COALESCE(episode_number, 0))` so backend correctness does not depend solely on frontend key generation;
- write path must treat `23505` from either unique constraint as an idempotent hit and still return `202`, because `ON CONFLICT (idempotency_key)` does not catch conflicts on the session/video/episode unique index;
- worker aggregation only reads rows with `aggregated_at IS NULL`.

Time trust invariant:

- clients may send `occurredAt`, but server must not use it blindly for buckets;
- service should clamp `occurred_at` to an allowed window around `ingested_at` (ADR to choose tolerance, for example +/- 10 minutes);
- events outside the tolerance fall back to `ingested_at`;
- bucket calculations use the trusted/clamped `occurred_at`, not raw client time.

### `video_play_hourly`

Near-term trend and hot-ranking bucket.

```sql
CREATE TABLE IF NOT EXISTS video_play_hourly (
  video_id              UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_hour           TIMESTAMPTZ NOT NULL,
  play_count            BIGINT NOT NULL DEFAULT 0,
  anon_play_count       BIGINT NOT NULL DEFAULT 0,
  logged_in_play_count  BIGINT NOT NULL DEFAULT 0,
  total_watch_seconds   BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, bucket_hour)
);

CREATE INDEX IF NOT EXISTS idx_video_play_hourly_hour
  ON video_play_hourly (bucket_hour DESC, play_count DESC);
```

### `video_play_daily`

Admin analytics and long-window trend truth.

```sql
CREATE TABLE IF NOT EXISTS video_play_daily (
  video_id              UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_date           DATE NOT NULL,
  play_count            BIGINT NOT NULL DEFAULT 0,
  unique_visitor_count  BIGINT NOT NULL DEFAULT 0,
  anon_play_count       BIGINT NOT NULL DEFAULT 0,
  logged_in_play_count  BIGINT NOT NULL DEFAULT 0,
  total_watch_seconds   BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_video_play_daily_date
  ON video_play_daily (bucket_date DESC, play_count DESC);
```

### `video_play_daily_visitors`

Dedup helper for daily unique visitors. This table is operational, not a frontend read model.

```sql
CREATE TABLE IF NOT EXISTS video_play_daily_visitors (
  video_id       UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_date    DATE NOT NULL,
  visitor_hash   TEXT NOT NULL,
  first_seen_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (video_id, bucket_date, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_video_play_daily_visitors_date
  ON video_play_daily_visitors (bucket_date);
```

### `video_play_totals`

O(1) cumulative display read model.

```sql
CREATE TABLE IF NOT EXISTS video_play_totals (
  video_id          UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  total_play_count  BIGINT NOT NULL DEFAULT 0,
  last_played_at    TIMESTAMPTZ NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_play_totals_count
  ON video_play_totals (total_play_count DESC);
```

### `video_hot_scores`

Materialized hot-score storage is required for cross-surface consistency. Read-time PG-only scoring cannot satisfy `/search?sort=hot`, because Elasticsearch cannot reference a transient PG calculation during query execution.

```sql
CREATE TABLE IF NOT EXISTS video_hot_scores (
  video_id          UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  hot_score         NUMERIC NOT NULL DEFAULT 0,
  play_count_24h    BIGINT NOT NULL DEFAULT 0,
  play_count_7d     BIGINT NOT NULL DEFAULT 0,
  play_count_30d    BIGINT NOT NULL DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_hot_scores_hot
  ON video_hot_scores (hot_score DESC, play_count_7d DESC);
```

ADR still decides the formula and half-life, but not whether a stable score source exists. The stable source is required so `/videos`, `/videos/trending`, `/search`, and home autofill can share the same ranking input.

## Public Write API

Endpoint:

```text
POST /videos/:id/play-events
```

The route param is named `:id` to match existing public video routes, where `:id` means the 8-character `short_id`. Handler/service names may call it `shortId` internally after validation.

Body:

```ts
{
  sourceId?: string
  episodeNumber?: number
  playSessionId: string
  idempotencyKey: string
  watchSeconds: number
  durationSeconds?: number
  occurredAt: string
  locale?: string
  referrerPath?: string
}
```

Route responsibilities:

- validate Zod body and `shortId`;
- use `request.ip` only; never parse `X-Forwarded-For` manually;
- call service;
- return `202 { data: { received: true } }`.

Service responsibilities:

- resolve `shortId -> video_id` with public visibility constraints;
- reject invalid or inactive `sourceId` if provided;
- consume `visitor_hash` from the centrally signed anonymous visitor cookie;
- hash `request.ip` and User-Agent;
- clamp or replace untrusted client `occurredAt`;
- enforce Redis rate-limit by both `visitor_hash + video_id + episode_number` and `ip_hash + video_id + episode_number`;
- insert event idempotently;
- never query `users` on unauthenticated path.

Rate limit should be defensive, not the counting truth. Counting truth is the unique `idempotency_key`.

## Frontend Integration

Primary insertion point: `PlayerShell`.

- Reuse the existing `previewMode` write guard.
- Generate `play_session_id` when video/episode playback starts.
- Track qualified threshold using `onTimeUpdate`.
- Report once per `video_id + episode_number + play_session_id`.
- Fire-and-forget; reporting failure must not affect playback.

Secondary insertion point: mini-player.

- Only needed if mini-player can independently cross the qualified threshold outside `PlayerShell`.
- Use the same helper for threshold and idempotency construction.

Shared frontend helper candidates:

- `buildPlaySessionId()`
- `buildPlayEventIdempotencyKey(input)`
- `isQualifiedPlay({ currentTime, duration })`
- `reportVideoPlayEvent(apiClient, payload)`

## Aggregation Worker

The worker must be replay-safe and batch-oriented.

Transaction shape:

Each batch is one transaction. Do not attempt to aggregate all pending events in a single transaction. Recommended initial batch limit: 500-1000 events, with the final value decided in ADR or implementation based on tests.

1. Select a bounded batch:

```sql
SELECT *
FROM video_play_events
WHERE aggregated_at IS NULL
ORDER BY ingested_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED;
```

2. Group rows in memory by:
   - `video_id + date_trunc('hour', occurred_at)` for hourly;
   - `video_id + occurred_at::date` for daily;
   - `video_id` for totals;
   - `video_id + date + visitor_hash` for daily UV.
3. Upsert `video_play_hourly`.
4. Upsert `video_play_daily_visitors`; use inserted-row count to increment `unique_visitor_count`.
5. Upsert `video_play_daily`.
6. Upsert `video_play_totals`.
7. Upsert `video_hot_scores`.
8. Mark selected events `aggregated_at = NOW()`.

This sequence is atomic per batch. If the transaction rolls back, events remain pending. If it commits, those events will not be reprocessed.

Scheduling options:

- Short term: add a worker cron, every 1 minute, matching `apps/worker` style.
- Alternative: add a dedicated Bull queue if hot-score recomputation becomes heavy.

Do not put this in the existing source-health feedback recheck job. Source health and video play volume are separate domains.

## Read Paths

### Frontend Display

Add `playCount` to `Video` and `VideoCard` in `packages/types/src/video.types.ts`.

`VIDEO_FULL_SELECT` should left join or lateral select `video_play_totals.total_play_count`, with `COALESCE(..., 0)`.

Consumer surfaces:

- video cards;
- detail page hero/meta row;
- watch page metadata;
- related rows if they display meta counts.

### `/videos?sort=hot`

Current behavior sorts by active source count. Replace with internal play heat.

Recommended order:

```text
hot_score DESC NULLS LAST,
play_count_7d DESC,
total_play_count DESC,
v.updated_at DESC
```

Read `hot_score`, `play_count_7d`, and `play_count_30d` from `video_hot_scores`.

### `/videos/trending`

Use `period=today|week|month` against hourly/daily aggregates:

- `today`: hourly rows since local/current day boundary or last 24h, ADR to choose.
- `week`: last 7 days.
- `month`: last 30 days.

Keep public visibility filters identical to `/videos`.

### `/search?sort=hot`

Search must not keep using only `rating_votes`.

Add ES document fields:

- `play_count_total`
- `play_count_7d`
- `hot_score`

Synchronization options:

- aggregator updates changed video documents after commit;
- scheduled `reconcile-search-index` includes play stat fields;
- dedicated batch updater for videos whose play aggregates changed.

ADR must choose the first implementation path and define staleness tolerance.

### Home Autofill

Internal play heat should become a candidate signal for home sections, but must not silently override curated configuration. Use it as one input to existing home autofill policy after ADR approval.

## Admin Analytics

Add an admin read model under existing analytics area, not the public route.

Suggested endpoints:

```text
GET /admin/analytics/video-plays/overview?period=7d|30d|90d
GET /admin/analytics/video-plays/trend?period=7d|30d|90d
GET /admin/analytics/video-plays/top-videos?period=7d|30d|90d&limit=20
```

Metrics:

- total plays in period;
- total watch seconds;
- average watch seconds per play;
- anonymous vs logged-in split;
- daily trend;
- top videos by period play count;
- top videos by growth if previous-window comparison is added.

Admin analytics must read aggregate tables only. It must not scan `video_play_events` except for debugging/internal ops.

## Retention

Recommended defaults:

- `video_play_events`: retain 90 days after `aggregated_at IS NOT NULL`;
- `video_play_daily_visitors`: retain 400 days or one analytics year;
- `video_play_hourly`: retain 90 days;
- `video_play_daily`: retain indefinitely;
- `video_play_totals`: retain indefinitely.

Retention should be a maintenance job and must not delete unaggregated events.

## Privacy

- No raw IP storage.
- No raw User-Agent storage.
- `visitor_hash` must be non-reversible.
- visitor cookie signing/refresh must be owned by one middleware or service boundary, not each write endpoint.
- Public unauthenticated path must not load user profile data.
- If optional auth is added later, user identity must be consumed from already verified auth context only.
- Admin analytics should show aggregate dimensions, not raw visitor hashes.

`watch_history` remains a per-user resume/progress feature. `video_play_events` is a video-level aggregate signal. A logged-in play may eventually update both, but the two tables have different semantics and must not be reconciled as if they should match row-for-row.

## Task Split

This is intentionally not a single implementation card. It crosses schema, API/service, worker, frontend, ES, and admin UI.

Recommended sequence:

1. `STATS-01-ADR` - ADR draft and review
   - Decide qualified play threshold, hot-score formula, ES sync strategy, retention, and auth/user_id boundary.
   - Requires Opus arch-reviewer and Codex adversarial review after the ADR is written.
2. `STATS-02-SCHEMA` - migrations + `architecture.md`
   - Create event/hourly/daily/visitor/totals/hot-score tables.
   - Add query module with insert and aggregate helpers.
3. `STATS-03-A-WRITE-ENDPOINT` - public write route/service
   - Add route/service and visitor cookie consumption.
   - Cover idempotency, time clamping, anonymous path, rate limits, and preview-mode rejection at service boundary.
   - Acceptance must include duplicate `idempotency_key` and duplicate `play_session_id + video_id + episode_number` with a different key; both return `202` and do not insert a second event.
4. `STATS-03-B-PLAYER-REPORTING` - frontend reporting
   - Add frontend threshold/idempotency helpers.
   - Wire `PlayerShell` first; wire mini-player only if needed.
   - Cover preview-mode no-report behavior.
5. `STATS-04-AGGREGATE` - worker aggregation + retention
   - Add batch aggregation worker and tests for retry/idempotency.
6. `STATS-05-A-PUBLIC-TYPES-READ` - frontend display read model
   - Add `playCount` to types and query projections.
7. `STATS-05-B-PUBLIC-HOT` - `/videos` and `/videos/trending`
   - Replace source-count/updated-at placeholder sorting with `video_hot_scores`.
8. `STATS-06-SEARCH-HOT` - ES hot fields and synchronization
   - Make `/search?sort=hot` semantically align with `/videos?sort=hot`.
9. `STATS-07-ADMIN-ANALYTICS` - admin trend/top videos
   - Add admin endpoints and UI.
   - Requires a dedicated admin endpoint ADR entry and Opus PASS before implementation; `verify:endpoint-adr` must see the new routes.

If scope must be reduced, keep `STATS-01` through `STATS-05-B` as the minimum product-complete slice for frontend display and PG hot ranking. Do not claim search hot-sort completion until `STATS-06` lands.

## Validation Gates

Implementation cards must run the normal gates for their scope:

- `npm run typecheck`
- `npm run lint`
- relevant unit tests or `npm run test:changed`
- `npm run verify:adr-contracts`
- `npm run verify:endpoint-adr` when admin endpoints are added
- `npm run test:e2e` for PLAYER / SEARCH / VIDEO-facing cards

Additional required tests:

- duplicate `idempotency_key` inserts do not duplicate events;
- duplicate `play_session_id + video_id + episode_number` with a different `idempotency_key` is treated as idempotent success, not a 500;
- repeated aggregation does not double-count;
- worker crash before commit leaves events pending;
- worker commit marks events aggregated;
- daily visitor dedup increments UV once per visitor/day/video;
- anonymous play event path does not require auth;
- `previewMode=true` does not report;
- `/videos?sort=hot` changes order based on play aggregates;
- `/search?sort=hot` uses ES play fields after `STATS-06`.
- malicious/future/past `occurredAt` is clamped or replaced before bucketing;
- Redis limiter applies visitor and IP dimensions.

## Open ADR Decisions

These must be decided before implementation:

1. Qualified play threshold: 20s vs 30s, and short-video percentage.
2. `today` period semantics: calendar day vs rolling 24h.
3. Hot score formula and half-life.
4. ES synchronization path and acceptable staleness.
5. Whether `user_id` is omitted in v1 or written only from optional auth context.
6. Retention durations and whether they are configurable via system settings.
7. Anonymous visitor cookie owner, flags, max age, and fallback behavior when cookies are disabled.
8. Deterministic `idempotency_key` formula and the business unique constraint shape.
9. `occurred_at` server trust strategy and clamp tolerance.
10. Initial aggregation batch size and worker schedule.

## Recommendation

Proceed with an ADR using this document as the draft input. The two most important correctness constraints are:

- event writes and aggregation must be idempotent;
- hot ranking must be consistent across `/videos`, `/videos/trending`, and `/search` once the feature is declared complete.

Do not implement a sampled counter in v1. Exact event counting with bounded rate limits is simpler and better matches frontend display expectations.
