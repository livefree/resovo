# Project Plan

## Goal

Turn `douban-adapter` into a standalone external package with two clear layers:

1. `resolver`
2. `subject adapter`

The package is not considered complete until both layers exist and are usable
without relying on the original host project.

## Architecture

### Layer 1: resolver

Purpose:

- accept human-readable video metadata
- locate matching Douban subjects
- return a chosen `subject id` plus matching context

Input examples:

- `title`
- `year`
- `type`
- `aliases`
- `actors`

Expected capabilities:

- search candidate subjects
- normalize and rank candidates
- disambiguate by year, type, aliases, and people
- expose a stable resolver API

### Layer 2: subject adapter

Purpose:

- accept a known Douban `subject id`
- fetch and normalize Douban data

Expected capabilities:

- details
- comments
- recommendations
- celebrity works
- anti-crawler handling
- cookies support
- optional browser bypass
- Mobile API fallback

## Current Status

### Completed

- standalone package structure
- independent build and test workflow
- host-agnostic runtime adapter
- details core service
- resolver:
  - subject search page integration
  - candidate normalization
  - candidate scoring
  - stable chosen subject id selection
- HTML parser
- Mobile API fallback
- snake_case compatibility output
- comments adapter
- recommendations adapter
- celebrity works adapter
- offline package tests for:
  - movie HTML path
  - tv HTML path
  - challenge -> Mobile API fallback path
  - resolver exact match path
  - resolver ambiguous match ranking path
  - comments parser path
  - comments service path
  - recommendations service path
  - celebrity works parser path
  - celebrity works search mode path
  - celebrity works api mode path

### Not Completed

- resolver release hardening
- broader real-world online validation
- publish/versioning finalization

## Delivery Phases

### Phase A: package foundation

Status: `done`

Scope:

- package metadata
- independent TypeScript build
- independent tests
- host runtime abstraction
- public API cleanup
- remove host-project naming and path traces

Acceptance:

- `npm run typecheck` passes in package directory
- `npm test` passes in package directory
- package no longer references host-only code paths or aliases

### Phase B: subject adapter details

Status: `done`

Scope:

- `getById(subjectId)`
- anti-crawler verification flow
- direct fetch path
- cookies support
- challenge detection
- browser bypass hook
- Mobile API fallback
- snake_case compatibility mapping

Acceptance:

- details path works for normal HTML path
- details path works for challenge -> Mobile API fallback
- compatibility output stays stable

### Phase C: resolver

Status: `done`

Scope:

- subject search endpoint integration
- candidate normalization
- candidate scoring
- final subject selection

Proposed API:

```ts
resolveSubjectId({
  title,
  year,
  type,
  aliases,
  actors,
});
```

Acceptance:

- can return at least one ranked candidate set
- can produce a stable chosen `subject id`
- has tests for exact match and ambiguous match cases
- live-sample scoring refinement remains part of release hardening

### Phase D: subject adapter comments

Status: `done`

Scope:

- fetch short comments
- normalize response shape
- reuse anti-crawler and fallback strategy where applicable

Acceptance:

- comments API works from known `subject id`
- normalized output is documented and tested

### Phase E: subject adapter recommendations

Status: `done`

Scope:

- fetch related subject recommendations
- normalize response shape

Acceptance:

- recommendations API works for package-defined list discovery inputs
- tests cover response normalization

### Phase F: subject adapter celebrity works

Status: `done`

Scope:

- fetch works from Douban celebrity/person endpoints
- normalize response shape

Acceptance:

- celebrity works API is independent from details API
- tests cover name, id, and result normalization

### Phase G: release hardening

Status: `in_progress`

Scope:

- real online sample verification
- release checklist
- versioning policy
- publish-ready package metadata

Acceptance:

- validate against at least 2 to 3 live sample ids when network is available
- docs match actual public API
- package is handoff-ready for another team

## Immediate Next Work

Priority order:

1. perform broader online verification
2. refine resolver scoring based on live samples
3. review publish/version metadata
4. complete final handoff checklist

## Completion Definition

`douban-adapter` is considered complete only when:

- `resolver` is implemented
- `subject adapter` supports `details`, `comments`, `recommendations`, and `celebrity works`
- package remains host-agnostic
- build and tests run in package directory
- public docs reflect the real API surface
- release checklist items are satisfied
