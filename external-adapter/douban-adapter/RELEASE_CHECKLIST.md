# Release Checklist

## Functional Scope

- `resolver` is exported and documented
- `details` service is exported and documented
- `comments` service is exported and documented
- `recommendations` service is exported and documented
- `celebrity works` service is exported and documented

## Validation

- run `npm run typecheck`
- run `npm test`
- verify generated `dist/` is up to date
- verify package docs match exported API surface

## Host Independence

- no `Next.js` runtime imports remain
- no host-only path aliases remain
- no host project names remain in public docs
- package works with only injected runtime dependencies

## Live Verification

- validate at least 2 to 3 live `subject id` samples for `details`
- validate at least 1 live resolver query with ambiguous candidates
- validate at least 1 live comments request
- validate at least 1 live recommendations request
- validate at least 1 live celebrity works request in `search` mode
- validate at least 1 live celebrity works request in `api` mode

Latest run: `2026-04-04`

- passed: resolver movie query
- passed: resolver tv query
- passed: live movie details sample
- passed: live tv details sample via resolver-chosen id
- failed: live comments sample without stronger anti-crawler support
- passed: live recommendations sample
- passed: live celebrity works `search` sample
- passed: live celebrity works `api` sample

Current interpretation:

- main package functionality is live-viable
- `comments` needs stronger host runtime support in real Douban challenge conditions

## Publish Readiness

- confirm package version bump
- confirm `files` list includes required docs
- confirm installation instructions are accurate
- confirm handoff notes are sufficient for another team
