# Implementation Plan: Harden the Country-Metadata Contract

**Branch**: `002-country-metadata-contract` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-country-metadata-contract/spec.md`

## Summary

The country registry (`src/features/countries/registry.ts`) is already the single source of truth driving both `GET /api/v1/countries/:code/fields` and the submit-time `.strict()` validator. This feature hardens the metadata contract so the frontend can render and validate entirely from it:

1. Add a content-derived `version` string to the fields response (deterministic hash of that country's field definitions) for client cache validation/invalidation.
2. Guarantee payload completeness (already mostly true): `key`, `label`, `required`, `type`, `options`, `validation`, `order`.
3. Guarantee `validation.pattern` is a JSON-safe regex source, client-compilable, free of catastrophic backtracking — and document the authoring rule.
4. Confirm `GET /countries` returns `code` + `name`.
5. Keep the submit validator authoritative (`.strict()`, registry-derived). No DB schema change.

Technical approach: add a pure `hashCountryFields()` helper deriving a stable hash from a canonical JSON serialization of a country's `fields`, surface it via the metadata projection, extend the response Zod schema with `version`, and add a registry-wide test asserting all patterns are JSON-safe and backtracking-safe. The submit path is unchanged.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24.0.1 (ESM / NodeNext, `strict`, `noUncheckedIndexedAccess`)

**Primary Dependencies**: Fastify 5, Zod 4, `fastify-type-provider-zod`; `node:crypto` (stdlib) for hashing — no new dependency

**Storage**: Postgres + Drizzle — **unchanged** (`addresses`: `country_code` + `fields` jsonb). No migration.

**Testing**: Vitest 4 via `app.inject()`; co-located `*.test.ts`, one per source file

**Target Platform**: Linux server (containerized)

**Project Type**: Single backend web service

**Performance Goals**: Metadata endpoints are read-only and registry-bound; `version` computed per request from in-memory data (microseconds) — optionally memoizable. No measurable impact.

**Constraints**: `version` MUST be a pure function of field-definition content (stable across requests + process restarts); patterns MUST survive JSON round-trip and be backtracking-safe

**Scale/Scope**: 3 supported countries today (USA/AUS/IDN), ~5-6 fields each; registry-bound, extensible by adding entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| I. Schema-Driven Validation at Every Boundary | ✅ `version` added to `countryFieldsResponseSchema`; submit validation unchanged and remains registry-derived. No new `process.env` reads. |
| II. Country Metadata Is Data, Not Code | ✅ Reinforces it — adds a content hash + completeness guarantees over the declarative registry; no per-country branching. Served rules stay identical to enforced rules. |
| III. Strict Layering & Feature Isolation | ✅ Changes confined to `features/countries/` (registry/service/schemas) + tests. `hashCountryFields` is pure; no DB, no Fastify imports in service logic. `buildAddressValidator` still consumed via barrel. |
| IV. Typed Errors & RFC 7807 | ✅ Unsupported country still `NotFoundError` (fields) / `BadRequestError` (submit). No new error paths. |
| V. Structured, Redacted Observability | ✅ No new logging; no PII. |
| VI. Test-First Against Real Postgres | ✅ New unit tests for hash determinism + pattern safety (no DB needed); existing submit tests against real Postgres unchanged. Validation coverage per country preserved. |
| VII. Contract-First API (OpenAPI from schemas) | ✅ `version` flows into OpenAPI via the extended Zod response schema; spec regenerates automatically. |

**Result**: PASS — no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-country-metadata-contract/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── countries-fields.md
│   └── countries-list.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/features/countries/
├── registry.ts          # + hashCountryFields() pure helper; FieldValidation.pattern doc note
├── service.ts           # getCountryFields() includes version; submit derivation unchanged
├── schemas.ts           # countryFieldsResponseSchema gains version: string
├── routes.ts            # unchanged (response schema drives it)
├── index.ts             # barrel — export hashCountryFields if needed by tests
├── registry.test.ts     # NEW: pattern JSON-safety + catastrophic-backtracking guard; hash determinism/isolation
└── service.test.ts      # version present + stable + changes on field-def change; payload completeness

src/features/addresses/
└── service.test.ts      # (existing) submit gate: unknown key + rule violations still rejected — confirm coverage
```

**Structure Decision**: Single backend service; all changes live in the existing `countries` feature folder following the established `routes → service → registry` layering. No new feature, no new endpoint, no DB change.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
