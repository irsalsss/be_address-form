<!--
SYNC IMPACT REPORT
==================
Version change: (template / unversioned) → 1.0.0
Bump rationale: First ratified constitution. MAJOR baseline establishing the
  initial governing principle set for the acme-address-api backend.

Modified principles: none (initial adoption)
Added principles:
  - I. Schema-Driven Validation at Every Boundary (NON-NEGOTIABLE)
  - II. Country Metadata Is Data, Not Code
  - III. Strict Layering & Feature Isolation
  - IV. Typed Errors & RFC 7807 Responses
  - V. Structured, Redacted Observability
  - VI. Test-First Against Real Postgres (NON-NEGOTIABLE)
  - VII. Contract-First API (OpenAPI Generated From Schemas)
Added sections:
  - Additional Constraints (Stack & Scope)
  - Development Workflow & Quality Gates
Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (generic Constitution Check
    gate, no hardcoded principles — no edit needed)
  - .specify/templates/spec-template.md ✅ aligned (no constitution coupling)
  - .specify/templates/tasks-template.md ✅ aligned (no constitution coupling)
  - .specify/templates/checklist-template.md ✅ aligned
  - CLAUDE.md ✅ consistent (constitution codifies existing contract; no drift)

Follow-up TODOs: none
-->

# acme-address-api Constitution

## Core Principles

### I. Schema-Driven Validation at Every Boundary (NON-NEGOTIABLE)

Every external input MUST pass through a Zod schema before any business logic
runs. This applies to HTTP request body/query/params (parsed in the route
handler via `fastify-type-provider-zod`), environment variables (parsed once at
boot in `src/shared/config/env.ts`), and external API responses (parsed inside
the fetcher in `service.ts`). Reading `process.env.*` anywhere outside
`src/shared/config/env.ts` is FORBIDDEN and is enforced by the ESLint
`no-restricted-properties` rule. No input crosses a boundary unparsed — there
are no exceptions.

**Rationale**: Addresses are country-shaped and user-supplied; unvalidated
input is the primary source of both bad data and security defects. A single
parse chokepoint per boundary makes correctness auditable.

### II. Country Metadata Is Data, Not Code

Country-specific field layouts and validation rules (field names, order,
required/optional flags, dropdown option sets, postal-code patterns) MUST be
expressed as declarative metadata, not as branching logic scattered across
handlers. Adding or changing a supported country MUST NOT require editing route
or service control flow — only the country metadata definition and its Zod
schema. The backend MUST expose this metadata via a read API so clients can
render and validate forms dynamically rather than hardcoding layouts. Per-field
validation rules served to clients MUST be the same rules the server enforces;
the server is the source of truth and re-validates every submission.

**Rationale**: The product requirement is a form that adapts per country
(USA/AUS/IDN today, more later). Modeling country shape as data keeps the
system extensible to new countries without code churn and prevents client and
server validation from diverging.

### III. Strict Layering & Feature Isolation

The dependency direction is fixed: `routes.ts` → `service.ts` → `repository.ts`
→ `db`. A route MUST NOT call a repository directly; a service MUST NOT touch
the DB client directly. `repository.ts` is the ONLY file permitted to import
`db` from `shared/db/client.ts`. Services contain pure logic and MUST NOT import
framework (Fastify) types. Features may import from `shared/`, but MUST NOT
reach into another feature's internals — only through that feature's `index.ts`
barrel. `shared/` MUST NOT import from `features/`. Absolute imports use the
`@/` alias.

**Rationale**: Predictable layering keeps logic unit-testable in isolation,
confines persistence concerns to one file, and prevents the feature graph from
degrading into a tangle as countries and endpoints grow.

### IV. Typed Errors & RFC 7807 Responses

Routes and services MUST raise typed `AppError` subclasses (`BadRequestError`,
`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`).
Throwing a bare `Error` from a route or service is FORBIDDEN — wrap or rethrow
as an `AppError`. The error handler serializes every failure to
`application/problem+json` (RFC 7807) with `title`, `status`, `detail`,
`instance`, and `code`. `ZodError` MUST surface as a 400 with field-level
detail. `InternalError` (500) is reserved for unhandled cases and MUST NOT be
thrown directly.

**Rationale**: One consistent, machine-readable error contract lets clients
distinguish validation failures from conflicts and not-founds programmatically,
which a dynamic multi-country form depends on for field-level error display.

### V. Structured, Redacted Observability

All logging goes through the pino logger in `src/shared/logger.ts`.
`console.log` in committed code is FORBIDDEN (`no-console` ESLint rule), and
ad-hoc logger instances MUST NOT be constructed. Sensitive keys
(`authorization`, `cookie`, `password`, `token`, `secret`, `apiKey`) MUST stay
in the redaction set. Every log line MUST carry the request id (`req.id`, from
Fastify `genReqId`/`x-request-id`). Development uses pino-pretty; production
emits JSON.

**Rationale**: Address submissions and any place-lookup keys are sensitive;
structured, request-correlated, redacted logs are required to debug a dynamic
flow without leaking PII or credentials.

### VI. Test-First Against Real Postgres (NON-NEGOTIABLE)

Tests are authored before or alongside the code they cover, one test file per
source file, co-located (`service.ts` → `service.test.ts`). Vitest is the only
runner, and HTTP behavior MUST be exercised through Fastify's `app.inject()` —
not a real socket. Database-touching tests MUST run against real Postgres (test
schema or testcontainers); mocking the database is FORBIDDEN. Validation
behavior for each supported country (required fields, postal-code length, valid
dropdown values, rejection of unknown fields) MUST have explicit test coverage.

**Rationale**: Per-country validation is the core risk surface; DB mocks hide
schema and query defects. Real-Postgres, inject-based tests catch exactly the
failures this feature is prone to.

### VII. Contract-First API (OpenAPI Generated From Schemas)

The OpenAPI spec MUST be generated from route Zod schemas via
`fastify-type-provider-zod` + `jsonSchemaTransform` — never hand-edited. Every
route MUST register its request and response schemas. Swagger UI (`/docs`) is
exposed in development only and MUST be stripped in production. The persisted
address shape (e.g. `country`, `line1`, `line2`, `city`, `state`/`province`,
`postalCode`, plus country-specific fields) is owned by the DB schema and its
migrations; schema changes flow through `pnpm db:generate` →
`pnpm db:migrate`, and migration history is append-only.

**Rationale**: A generated spec cannot drift from the implementation, so the
contract clients build the dynamic form against is always accurate.

## Additional Constraints (Stack & Scope)

- **Locked stack**: Node 24, TypeScript 6 (`strict`,
  `noUncheckedIndexedAccess`), Fastify 5, Zod 4, Drizzle ORM + `postgres`
  driver, pino 10, Vitest 4. Version changes are governed by the amendment
  process below.
- **Scope is backend-only**: this constitution governs the API and persistence
  for capturing and retrieving addresses. Frontend rendering of the dynamic form
  is out of scope here but is a consumer of Principle II's metadata API.
- **Type discipline**: `any` is FORBIDDEN; use `unknown` + narrowing. Use
  async/await only — no `.then()` chains. NodeNext requires explicit `.js`
  extensions on relative imports even from `.ts` sources.
- **File conventions**: `kebab-case.ts` filenames; barrel `index.ts` only at
  feature and package roots; import order external → workspace → `@/` →
  relative.
- **Do-not-touch**: `dist/`, `node_modules/`, `*.tsbuildinfo`, applied
  `drizzle/*.sql` migrations, and `pnpm-lock.yaml` (never hand-edited). `.env`
  is never committed; new keys are mirrored into `.env.example`.

## Development Workflow & Quality Gates

- A change is mergeable only when `pnpm lint`, `pnpm type-check`, and
  `pnpm test:ci` all pass.
- New features follow the documented sequence: create the feature folder
  (`routes.ts`, `service.ts`, `repository.ts`, `schemas.ts`, `index.ts`),
  define Zod schemas first, implement repository → service → routes, register in
  `app.ts`, write co-located tests, and verify the generated spec in `/docs`.
- Every PR MUST verify compliance with the Core Principles. A reviewer flags any
  violation (unparsed input, layering breach, bare `Error`, `console.log`,
  hardcoded per-country branching, DB mock) as a blocking issue.
- When code and `CLAUDE.md` disagree, the same PR MUST fix both. A drifted
  `CLAUDE.md` is treated as a defect.

## Governance

This constitution supersedes ad-hoc conventions for the backend. Amendments MUST
be proposed via PR, state the rationale and any migration impact, and update
this file together with `CLAUDE.md` and any affected `.specify/templates/*` in
the same change.

Versioning follows semantic versioning of governance: **MAJOR** for removing or
redefining a principle in a backward-incompatible way, **MINOR** for adding a
principle or materially expanding guidance, **PATCH** for clarifications and
non-semantic wording fixes.

Compliance is enforced continuously: ESLint rules (`no-console`,
`no-restricted-properties`), the type checker, and CI test gates are the
automated arm; PR review is the human arm. Complexity that appears to violate a
principle MUST be justified in the PR description or removed. Use `CLAUDE.md` as
the day-to-day runtime development guide; this constitution is the authority it
must conform to.

**Version**: 1.0.0 | **Ratified**: 2026-06-14 | **Last Amended**: 2026-06-14
