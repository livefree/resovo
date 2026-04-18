# Development Log

## 2026-04-03

### Step: project roadmap

- added `PROJECT_PLAN.md`
- aligned `README.md` with current package scope
- clarified that the package is incomplete until both `resolver` and `subject adapter` are delivered

### Step: local test baseline recovery

- restored `node_modules` in package directory
- reran `npm run typecheck`
- reran `npm test`

### Step: resolver phase 1

- added standalone `resolver` types, helpers, and service
- implemented `subject_search` page parsing via `window.__DATA__`
- added candidate ranking by title, alias, year, type, and actor matches
- added offline resolver tests for ranked candidate search and stable id selection

### Step: comments phase 1

- added standalone comments types, helpers, HTML parser, and service
- reused anti-crawler, cookies, and optional browser bypass strategy
- added offline tests for comments parser and normalized comments service output

### Step: recommendations phase 1

- added standalone recommendations types, helpers, and service
- implemented mobile API request builder and normalized recommendation list output
- added offline test coverage for recommendation list normalization

### Step: celebrity works phase 1

- added standalone celebrity works types, helpers, HTML parser, and service
- preserved both `search` and `api` modes from the host implementation
- added offline coverage for parser, search mode, and api mode

### Step: release hardening prep

- updated package plan to reflect that all four main adapter capabilities are implemented
- added a release checklist for handoff and publish readiness
- aligned README and integration guide with the current package surface

### Step: live validation round 1

- added `npm run test:live` and a standalone live validation script
- validated live resolver, details, recommendations, and celebrity works flows on 2026-04-04
- observed `comments` failing without stronger anti-crawler support in the validation runtime
- replaced stale fixed TV sample usage with resolver-driven live subject selection
- latest live result summary: `7/8` checks passed on 2026-04-04

### Step: comments challenge hardening

- updated comments service to try browser bypass after both anti-crawler and direct-fetch challenge responses
- added test coverage for challenge to bypass success path
- documented that strict real-world comments access may require cookies or browser bypass support from the host
