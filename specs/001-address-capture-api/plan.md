# Implementation Plan: Country-Aware Address Capture API

**Branch**: `001-address-capture-api` (working on `master`) | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-address-capture-api/spec.md`

## Summary

Backend for capturing country-shaped addresses. A configuration-driven **country
registry** is the single source of truth: from each country's ordered field
definitions it derives (a) the metadata served to clients for dynamic form
rendering and (b) the runtime Zod validator that gates submissions. Accepted
addresses persist to Postgres with the full submitted field set stored as JSONB
(field fidelity) plus a promoted `country_code` and `created_at`. REST endpoints
expose country metadata, address create, address list, and address-by-id. Adding
a country = adding one registry entry, no flow changes (FR-016 / SC-004).

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24.0.1 (ESM / NodeNext)

**Primary Dependencies**: Fastify 5.8, `fastify-type-provider-zod` 6.1, Zod 4.4,
Drizzle ORM 0.45 + `postgres` 3.4 driver, pino 10

**Storage**: PostgreSQL 17 (local via docker compose); Drizzle migrations

**Testing**: Vitest 4.1 via `app.inject()`; real Postgres for repository tests
(no DB mocks)

**Target Platform**: Linux server (containerized, distroless node24)

**Project Type**: Web service (single backend project; frontend out of scope)

**Performance Goals**: Standard web API; no special scale target for this demo.
Metadata endpoints are read-mostly and cacheable.

**Constraints**: All external input Zod-parsed at the boundary; no `process.env`
reads outside `shared/config/env.ts`; typed `AppError` → RFC 7807; pino-only
logging with redaction; `@/` alias; explicit `.js` import extensions.

**Scale/Scope**: 3 launch countries (USA, AUS, IDN), 5 endpoints, 1 table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan compliance |
|---|---|
| I. Schema-Driven Validation (NON-NEGOTIABLE) | Submission validated by a registry-derived Zod schema in the route via `fastify-type-provider-zod`; country code param validated; no unparsed input. ✅ |
| II. Country Metadata Is Data, Not Code | Country registry holds field defs; metadata API and submit validator both derive from it — one source of truth (FR-014). No per-country branching in flow. ✅ |
| III. Strict Layering & Feature Isolation | `routes → service → repository → db`; only `repository.ts` imports `db`; registry lives in feature, service stays framework-free. ✅ |
| IV. Typed Errors & RFC 7807 | `BadRequestError` (validation/unsupported via ZodError auto-wrap), `NotFoundError` (unknown id/country). No bare `Error`. ✅ |
| V. Structured, Redacted Observability | pino logger from `shared/logger.ts`; `req.id` on every line; no ad-hoc logging of full bodies. ✅ |
| VI. Test-First Against Real Postgres (NON-NEGOTIABLE) | Co-located tests per file; accept+reject coverage per country; repository tests hit real Postgres. ✅ |
| VII. Contract-First OpenAPI | Every route registers Zod request/response schemas → spec auto-generated; `/docs` dev-only. ✅ |

**Result**: PASS. No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-address-capture-api/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI sketch)
│   └── openapi.yaml
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── app.ts                         # register countriesRoutes + addressesRoutes
├── shared/
│   └── db/
│       └── schema.ts              # + addresses table (Drizzle)
└── features/
    ├── countries/
    │   ├── registry.ts            # SOURCE OF TRUTH: country field definitions
    │   ├── schemas.ts             # Zod: metadata response; derive submit validator
    │   ├── service.ts             # list countries, get country fields, build validator
    │   ├── routes.ts              # GET /countries, GET /countries/:code/fields
    │   ├── index.ts               # barrel
    │   ├── registry.test.ts
    │   ├── service.test.ts
    │   └── routes.test.ts
    └── addresses/
        ├── schemas.ts             # Zod: create request (registry-derived), responses
        ├── repository.ts          # ONLY file importing db; insert/list/findById
        ├── service.ts             # validate via countries, persist, map
        ├── routes.ts              # POST /addresses, GET /addresses, GET /addresses/:id
        ├── index.ts               # barrel
        ├── schemas.test.ts
        ├── repository.test.ts
        ├── service.test.ts
        └── routes.test.ts

drizzle/
└── <timestamp>_add_addresses.sql  # generated migration
```

**Structure Decision**: Single web-service project, two features. `countries`
owns the registry + metadata; `addresses` owns persistence/retrieval and reuses
`countries`' validator via that feature's `index.ts` barrel (Principle III — no
reaching into internals). The registry is plain data + pure derivation, keeping
Principle II satisfiable without DB-backed config for this scope.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
