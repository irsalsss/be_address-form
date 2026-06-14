---
description: "Task list for Country-Aware Address Capture API"
---

# Tasks: Country-Aware Address Capture API

**Input**: Design documents from `specs/001-address-capture-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: INCLUDED — Constitution Principle VI (Test-First Against Real Postgres)
is NON-NEGOTIABLE. Repository tests hit real Postgres; route/service via `app.inject()`.

**Organization**: Grouped by user story (US1 Save → US2 Retrieve → US3 Metadata).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (story-phase tasks only)
- Paths are repo-root relative; ESM/NodeNext → relative imports use `.js`.

## Path Conventions

Single web-service project. Source in `src/`, co-located `*.test.ts`. Migrations in `drizzle/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature scaffolding before any story logic.

- [X] T001 Create `src/features/countries/` and `src/features/addresses/` folders with empty `index.ts` barrels per plan.md structure
- [X] T002 [P] Add `API_PREFIX`/version note — confirm routes register under `/api/v1` in `src/app.ts` (no new env needed; reuse existing `env.ts`)
- [X] T003 [P] Verify test harness: `tests/setup.ts` sets `NODE_ENV=test`, `PORT=0`, dummy `DATABASE_URL`; confirm a real-Postgres connection string for repository tests is available (docker compose `db`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence + country registry that every story depends on. MUST complete before US1/US2/US3.

- [X] T004 Define `addresses` table in `src/shared/db/schema.ts` — `id` uuid PK (uuidv7 default), `country_code` varchar(3) not null, `fields` jsonb not null, `created_at` timestamptz not null default now(); index on `created_at` desc (per data-model.md)
- [X] T005 Generate + apply migration: `pnpm db:generate` then `pnpm db:migrate`; confirm `drizzle/<timestamp>_*.sql` created (append-only — do not edit after)
- [X] T006 Create country registry types + data in `src/features/countries/registry.ts` — `Country`, `CountryFieldDef` types and USA/AUS/IDN entries with full field layouts, dropdown option sets (50 US states+DC, 8 AUS states, IDN province list), and validation rules (zip 5 / postcode 4 / postal 5, numeric) per data-model.md
- [X] T007 [P] Test registry integrity in `src/features/countries/registry.test.ts` — every dropdown field has non-empty `options`; field `key`s unique per country; ordered; required flags match spec layouts

**Checkpoint**: DB table live, registry is the single source of truth.

---

## Phase 3: User Story 1 — Save a captured address (Priority: P1) 🎯 MVP

**Goal**: Validate a submission against its country's rules and persist it, returning the stored record + id.

**Independent Test**: POST a valid USA address → 201 with id; read back identical fields. POST AUS missing suburb → 400 field error; nothing stored.

### Validator + schemas (registry-derived)

- [X] T008 [US1] Implement `buildAddressValidator(code)` in `src/features/countries/service.ts` — derive a `.strict()` Zod object from a country's field defs (required text → trim min 1; optional text → optional; dropdown → `z.enum(options)`; numeric+length → `regex(/^\d{N}$/)`); throw `BadRequestError` on unsupported country
- [X] T009 [US1] Export `buildAddressValidator` + `isSupportedCountry` + canonical-code normalizer from `src/features/countries/index.ts` barrel (US `us`→`USA`)
- [X] T010 [P] [US1] Test validator derivation in `src/features/countries/service.test.ts` — per country: accept valid; reject missing required, bad dropdown value, wrong postal length, non-numeric postal, unknown extra field, whitespace-only required
- [X] T011 [US1] Define request/response Zod schemas in `src/features/addresses/schemas.ts` — `CreateAddressRequest` (`country: string`, `fields: record`), `AddressResponse` (`id`, `country`, `fields`, `createdAt`); register-able via `fastify-type-provider-zod`
- [X] T012 [P] [US1] Test schema shapes in `src/features/addresses/schemas.test.ts` — request rejects missing `country`/`fields`; response serializes `createdAt` as ISO

### Repository (only file importing db)

- [X] T013 [US1] Implement `insertAddress(countryCode, fields)` in `src/features/addresses/repository.ts` — sole importer of `db` from `shared/db/client.ts`; insert + return row
- [X] T014 [US1] Test `insertAddress` against real Postgres in `src/features/addresses/repository.test.ts` — round-trip fidelity: stored `fields` equal submitted (SC-001); `created_at` populated

### Service + route

- [X] T015 [US1] Implement `createAddress(input)` in `src/features/addresses/service.ts` — normalize country code, build validator via `countries` barrel, parse `fields`, call repository, map to `AddressResponse`; framework-free (no Fastify imports)
- [X] T016 [P] [US1] Test `createAddress` service in `src/features/addresses/service.test.ts` — valid persists+maps; invalid throws `BadRequestError`; unsupported country rejected
- [X] T017 [US1] Implement `POST /addresses` in `src/features/addresses/routes.ts` (under `/api/v1`) — register Zod schemas, call service, return 201; export `addressesRoutes` via `index.ts`
- [X] T018 [US1] Register `addressesRoutes` in `src/app.ts` with the Zod type provider
- [X] T019 [P] [US1] Route test in `src/features/addresses/routes.test.ts` via `app.inject()` — valid USA → 201 + id; AUS missing suburb → 400 problem+json naming field; IDN 4-digit postal → 400; unsupported country → 400; extra field → 400

**Checkpoint**: US1 independently shippable — addresses can be validated + stored. **MVP.**

---

## Phase 4: User Story 2 — Retrieve saved addresses (Priority: P2)

**Goal**: List all saved addresses and fetch one by id; not-found distinct from empty list.

**Independent Test**: Save two → list returns both; get by known id → 200; unknown id → 404.

- [X] T020 [US2] Add `listAddresses()` and `findAddressById(id)` to `src/features/addresses/repository.ts` — order list by `created_at` desc; `findById` returns null when absent
- [X] T021 [P] [US2] Repository tests in `src/features/addresses/repository.test.ts` — list returns inserted rows ordered; `findById` hit + miss (null)
- [X] T022 [US2] Add `getAllAddresses()` and `getAddressById(id)` to `src/features/addresses/service.ts` — map rows to `AddressResponse`; throw `NotFoundError` on missing id
- [X] T023 [P] [US2] Service tests in `src/features/addresses/service.test.ts` — list maps all; by-id maps one; missing → `NotFoundError`
- [X] T024 [US2] Add `GET /addresses` and `GET /addresses/:id` to `src/features/addresses/routes.ts` — uuid param schema; register response schemas
- [X] T025 [P] [US2] Route tests via `app.inject()` in `src/features/addresses/routes.test.ts` — list → 200 with both; by id → 200; nonexistent uuid → 404 (distinct from empty-list 200, SC-006)

**Checkpoint**: US1 + US2 — full capture + retrieval demo path.

---

## Phase 5: User Story 3 — Country metadata API (Priority: P2)

**Goal**: Serve supported countries and per-country field layouts + validation rules from the same registry that gates submissions (FR-014 parity).

**Independent Test**: GET `/countries` → USA/AUS/IDN; GET `/countries/IDN/fields` → province dropdown, required district, optional village, 5-digit postal, in order; unsupported code → 404.

- [X] T026 [US3] Add `listCountries()` and `getCountryFields(code)` to `src/features/countries/service.ts` — project registry entries to summaries + ordered field-def metadata; throw `NotFoundError` for unknown code
- [X] T027 [US3] Define metadata response Zod schemas in `src/features/countries/schemas.ts` — `CountrySummary`, `FieldDef` (key,label,required,type,options?,validation?,order)
- [X] T028 [P] [US3] Service tests in `src/features/countries/service.test.ts` — list returns 3; AUS fields expose exactly 8-state dropdown; USA zip validation length 5; unknown code → `NotFoundError`
- [X] T029 [US3] Implement `GET /countries` and `GET /countries/:code/fields` in `src/features/countries/routes.ts` (under `/api/v1`); export `countriesRoutes` via `index.ts`
- [X] T030 [US3] Register `countriesRoutes` in `src/app.ts`
- [X] T031 [P] [US3] Route tests via `app.inject()` in `src/features/countries/routes.test.ts` — `/countries` → 3; `/countries/IDN/fields` ordered layout; `/countries/XX/fields` → 404 problem+json
- [X] T032 [US3] Parity test in `src/features/countries/service.test.ts` — for each country, the served `validation`+`options` drive the same accept/reject as `buildAddressValidator` for sample inputs (FR-014 / SC-003)

**Checkpoint**: All three stories complete; dynamic-metadata bonus delivered.

---

## Phase 6: Polish & Cross-Cutting

- [X] T033 [P] Confirm `/docs` (dev-only) renders all 5 endpoints with generated schemas; no hand-edited spec (Principle VII)
- [X] T034 [P] Update `.env.example` if any new key introduced (none expected); confirm no `process.env` read outside `shared/config/env.ts`
- [X] T035 [P] Run `pnpm lint`, `pnpm type-check`, `pnpm test:ci` — all green; no `console.log`, no `any`, no bare `Error` (Principles I/IV/V)
- [X] T036 Walk `quickstart.md` scenarios 1–5 end-to-end against `pnpm dev`; confirm expected outcomes
- [X] T037 [P] Update `CLAUDE.md` folder-structure section to list `features/countries` + `features/addresses` and the `addresses` table (keep contract in sync)

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** block everything.
- **US1 (Phase 3)** depends only on Foundational → first independent increment = **MVP**.
- **US2 (Phase 4)** depends on Foundational + US1's repository/service files existing (extends same files).
- **US3 (Phase 5)** depends on Foundational (registry); independent of US1/US2 at the HTTP layer but reuses `countries/service.ts` (T008 already created it).
- **Polish (Phase 6)** after all stories.

Story independence: US3 can be built right after Foundational without US1/US2. US2 logically follows US1 (same feature files). MVP = Setup + Foundational + US1.

## Parallel Opportunities

- Phase 1: T002, T003 in parallel.
- Foundational: T007 parallel after T006.
- Within US1: test tasks T010, T012, T016, T019 [P] parallel to each other once their targets exist; repository (T013) and validator (T008) can proceed in parallel (different files).
- US2: T021, T023, T025 [P].
- US3: T028, T031 [P].
- Polish: T033, T034, T035, T037 [P].

## Implementation Strategy

1. **MVP**: Phases 1–3 (Setup + Foundational + US1) → demoable validate-and-store.
2. **Increment 2**: Phase 4 (US2) → retrieval for the demo.
3. **Increment 3**: Phase 5 (US3) → dynamic country-metadata bonus + parity guarantee.
4. **Harden**: Phase 6.
