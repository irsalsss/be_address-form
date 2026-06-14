# Phase 0 Research: Country-Aware Address Capture API

All Technical Context items resolved from the locked stack (CLAUDE.md) and the
constitution. No open NEEDS CLARIFICATION.

## Decision 1 — Country shape as a code registry, not a DB-backed config

- **Decision**: Model each country's field layout + validation as a typed
  in-code registry (`features/countries/registry.ts`), pure data + pure
  derivation functions.
- **Rationale**: Satisfies Principle II (metadata is data, not branching) and
  FR-014/FR-016 (one source of truth, add-country-by-config) without the
  complexity of a config table for a 3-country demo. Metadata response and the
  runtime Zod validator are both derived from the same entries, so they cannot
  diverge.
- **Alternatives considered**: (a) DB table `country_field_defs` — more moving
  parts, migration churn, no benefit at this scope; revisit if non-engineers
  must edit layouts at runtime. (b) Hardcoded per-country `if`/`switch` in
  service — violates Principle II, rejected.

## Decision 2 — Persist full submitted fields as JSONB + promoted columns

- **Decision**: `addresses` table = `id` (uuid pk), `country_code`, `fields`
  (jsonb of all submitted key→value), `created_at`. No per-field columns.
- **Rationale**: Field sets differ per country (US `state`/`zip` vs IDN
  `province`/`district`/`village`/`street`). JSONB stores exactly what was
  submitted → 100% read-back fidelity (SC-001) and zero schema change when a
  country is added (SC-004). `country_code` promoted for filtering; `created_at`
  for ordering. Postal code left inside `fields` (no cross-country query need).
- **Alternatives considered**: (a) Wide union-of-all-columns table — sparse,
  needs migration per new country, rejected. (b) EAV rows — query-heavy,
  overkill. (c) Separate table per country — explodes flow logic, rejected.

## Decision 3 — Derive the submit validator from the registry at request time

- **Decision**: `countries` service exposes `buildAddressValidator(code)`
  returning a Zod object schema built from that country's field defs (required
  vs optional, dropdown `z.enum`, postal `regex`). `addresses` route resolves
  the country from the request, builds the validator, and parses `fields`.
- **Rationale**: Keeps Principle I (Zod at boundary) and Principle II (same
  rules served + enforced). The dropdown/postal rules in the metadata response
  are generated from the same field defs the validator uses (SC-003).
- **Alternatives considered**: One giant static discriminated-union schema keyed
  by country — workable but duplicates rule expression and grows per country;
  derivation keeps it DRY. Kept as a fallback if dynamic build proves awkward.

## Decision 4 — Unknown/extra field handling

- **Decision**: Submit validator uses `.strict()` — unknown keys in `fields`
  are rejected with a 400. Country code normalized to upper-case canonical
  (`us`→`USA`) before lookup; unresolved code → 400 unsupported country.
- **Rationale**: Edge cases in spec (extra fields, casing). `.strict()` prevents
  silently storing junk as valid (SC-002).
- **Alternatives considered**: `.strip()` (silently drop unknowns) — hides
  client bugs, rejected for a validation-critical feature.

## Decision 5 — Error mapping

- **Decision**: Validation failures (ZodError) auto-wrap to `BadRequestError`
  (400) via the existing error handler; unknown country code and unknown address
  id → `NotFoundError` (404) for the metadata/by-id routes, `BadRequestError`
  for an unsupported country on submit. All serialize to RFC 7807.
- **Rationale**: Principle IV; FR-013 (distinguish validation vs not-found vs
  unsupported). Matches existing `shared/errors.ts` + `error-handler.ts`.
- **Alternatives considered**: Custom ad-hoc error shapes — violates the single
  RFC 7807 contract, rejected.

## Decision 6 — Testing approach

- **Decision**: Route + service tests via `app.inject()`; repository tests
  against real Postgres (test schema / testcontainers per CLAUDE.md). Each
  country gets explicit accept + reject cases for required fields, dropdown
  membership, and postal-code format (SC-005).
- **Rationale**: Principle VI; per-country validation is the core risk surface.
- **Alternatives considered**: DB mocks — forbidden by constitution.

## Resolved unknowns

| Item | Resolution |
|---|---|
| Storage engine | Postgres + Drizzle (locked) |
| Address field storage | JSONB `fields` + promoted `country_code`, `created_at` |
| Country config location | In-code registry (`features/countries/registry.ts`) |
| Validator strategy | Registry-derived Zod, built per request |
| Auth | None (demo) — documented assumption, follow-up before prod |
| US state / IDN province lists | Full enumerations authored in registry during impl |
