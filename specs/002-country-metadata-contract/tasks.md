---

description: "Task list for Harden the Country-Metadata Contract"
---

# Tasks: Harden the Country-Metadata Contract

**Input**: Design documents from `/specs/002-country-metadata-contract/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — required by Constitution Principle VI (Test-First, NON-NEGOTIABLE) and the spec's per-story Independent Tests.

**Organization**: Grouped by user story. Brownfield feature inside the existing `countries` feature folder; no setup/migration needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 (maps to spec.md user stories)
- Exact file paths included.

## Path Conventions

Single backend service. Source: `src/features/countries/`, `src/features/addresses/`. Tests co-located (`*.test.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline; no scaffolding required (existing feature folder, tooling, DB all in place).

- [x] T001 Confirm baseline green: run `pnpm lint`, `pnpm type-check`, `pnpm test:ci` and `docker compose up -d db` before changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building block consumed by the metadata projection.

**⚠️ CRITICAL**: T002–T003 block US1 (and the version surfaced by US2/US3 checks).

- [x] T002 Add pure `hashCountryFields(fields: CountryFieldDef[]): string` to `src/features/countries/registry.ts` — canonical JSON (declared field order; fixed sub-key order `key,label,required,type,options,validation`; omit absent optionals) → `node:crypto` SHA-256, return `"sha256:" + digestHex.slice(0,16)`. No new dependency. (research R1, data-model "Field Metadata Version")
- [x] T003 [P] Add authoring-rule doc comment on `FieldValidation.pattern` in `src/features/countries/registry.ts`: bare regex source (no delimiters/flags), JSON-round-trip-stable, no catastrophic backtracking. (FR-008/009/010)

**Checkpoint**: Hash helper available; user stories can proceed.

---

## Phase 3: User Story 1 - Cache and invalidate field metadata by version (Priority: P1) 🎯 MVP

**Goal**: Fields response carries a content-derived `version` that is stable across requests/restarts and changes only when a country's field definitions change.

**Independent Test**: Fetch a country's fields twice → identical `version`; alter that country's field defs → version changes; another country's version unchanged.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [x] T004 [P] [US1] In `src/features/countries/registry.test.ts`, test `hashCountryFields`: deterministic across calls; `sha256:` prefix; differs when a cloned country's fields are mutated (add/remove/reorder/relabel/required-toggle/options/validation change); two distinct countries' hashes are independent. (FR-002/003/004, SC-002/003)
- [x] T005 [P] [US1] In `src/features/countries/service.test.ts`, test `getCountryFields("USA").version` equals a second call; equals the alias call `getCountryFields("US").version`; has `sha256:` prefix. (FR-001/015, SC-002)

### Implementation for User Story 1

- [x] T006 [US1] Add `version: z.string()` to `countryFieldsResponseSchema` (top level, alongside `code`/`name`/`fields`) in `src/features/countries/schemas.ts`. (FR-001, contracts/countries-fields.md)
- [x] T007 [US1] In `getCountryFields()` in `src/features/countries/service.ts`, set `version: hashCountryFields(country.fields)` on the returned object. (FR-001, depends on T002, T006)
- [x] T008 [P] [US1] Export `hashCountryFields` from `src/features/countries/index.ts` barrel if referenced by tests outside the file. (Principle III)

**Checkpoint**: Fields endpoint returns stable, content-derived `version`; OpenAPI `/docs` shows it. MVP complete.

---

## Phase 4: User Story 2 - Render and pre-validate a form from one payload (Priority: P1)

**Goal**: Fields payload is complete enough to build form + client validation with no local country data.

**Independent Test**: For each country, every field has `key,label,required,type,order`; dropdowns include full `options`; constrained fields include `validation`.

### Tests for User Story 2 ⚠️

- [x] T009 [P] [US2] In `src/features/countries/service.test.ts`, for every country from `listCountryEntries()`: assert each `getCountryFields(code).fields[i]` has `key,label,required,type` and `order === i`; every `type:"dropdown"` field has non-empty `options` with `value`+`label`; fields with constraints expose `validation`. (FR-005/006/007, SC-001)

### Implementation for User Story 2

- [x] T010 [US2] Reconcile `fieldDefSchema`/projection in `src/features/countries/schemas.ts` + `src/features/countries/service.ts` with the completeness contract; fix any gap surfaced by T009 (else no-op — payload already complete). (FR-005/006/007, contracts/countries-fields.md)

**Checkpoint**: One fields fetch per country fully drives render + client validation.

---

## Phase 5: User Story 5 - Server remains the authoritative validation gate (Priority: P1)

**Goal**: Server re-validates every submission against the same registry; unknown keys + rule violations + missing required rejected.

**Independent Test**: Submit unknown field → rejected; submit rule violation / missing required → rejected.

### Tests for User Story 5 ⚠️

- [x] T011 [P] [US5] In `src/features/addresses/service.test.ts` (real Postgres via `app.inject()` per Principle VI), assert `createAddress` rejects: unknown field key; wrong-length numeric (e.g. USA `zip:"123"`); invalid dropdown value; missing required field. Confirm valid payload still persists. (FR-013/014, SC-005)
- [x] T012 [P] [US5] In `src/features/countries/service.test.ts`, assert metadata↔validator parity: for each country, `buildAddressValidator(code).schema` is `.strict()` and rejects an unknown key; its enforced rules match the served `validation` for representative fields. (FR-012, SC-005)

### Implementation for User Story 5

- [x] T013 [US5] Confirm `buildAddressValidator`/`fieldSchema` in `src/features/countries/service.ts` unchanged and registry-derived; fix only if T011/T012 reveal a gap (expected no-op). (FR-012/013/014)

**Checkpoint**: Server gate proven authoritative independent of client.

---

## Phase 6: User Story 3 - Compile server-provided patterns safely on the client (Priority: P2)

**Goal**: Any exposed `validation.pattern` is client-compilable, JSON-round-trip stable, and backtracking-safe.

**Independent Test**: Every pattern across all countries compiles, survives JSON round-trip, passes a catastrophic-backtracking guard.

### Tests for User Story 3 ⚠️

- [x] T014 [P] [US3] In `src/features/countries/registry.test.ts`, registry-wide guard over `listCountryEntries()`: for every field with `validation.pattern` — `new RegExp(src)` compiles; `JSON.parse(JSON.stringify(src)) === src`; heuristic rejects nested unbounded quantifiers (`(x+)+`, `(x*)*`, `(.*)*`-style). Passes vacuously today (no patterns) and guards future additions. (FR-008/009/010, SC-004)

### Implementation for User Story 3

- [x] T015 [US3] No code change to existing patterns (none exist); ensure doc rule from T003 is present and accurate. (FR-010)

**Checkpoint**: Pattern contract enforced by test for current + future countries.

---

## Phase 7: User Story 4 - Populate the country dropdown (Priority: P2)

**Goal**: Country list returns code + name for every supported country.

**Independent Test**: List returns all supported countries, each with non-empty code + name.

### Tests for User Story 4 ⚠️

- [x] T016 [P] [US4] In `src/features/countries/service.test.ts`, assert `listCountries()` returns one entry per `listCountryEntries()` country, each with non-empty `code` + `name`. (FR-011, SC-006)

### Implementation for User Story 4

- [x] T017 [US4] Confirm `listCountries()` + `countriesResponseSchema` unchanged and complete; no-op unless T016 fails. (FR-011, contracts/countries-list.md)

**Checkpoint**: Selector data confirmed.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T018 Run `pnpm lint`, `pnpm type-check`, `pnpm test:ci` — all green. (Quality gate)
- [x] T019 [P] Verify `/docs` (dev) shows `version` on the fields response schema. (FR-001, Principle VII)
- [x] T020 [P] Execute `specs/002-country-metadata-contract/quickstart.md` scenarios 1–5 against `pnpm dev`. (SC-001..006)
- [x] T021 Update `CLAUDE.md` countries-feature notes if the fields-response shape (now incl. `version`) needs documenting; keep code + docs in sync. (Governance)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. T002 blocks T007. T003 supports T014/T015.
- **User Stories (Phase 3–7)**: after Foundational. US1 establishes the `version`; US2–US5 are independently testable and mostly confirm/guard existing behavior.
- **Polish (Phase 8)**: after all targeted stories.

### User Story Dependencies

- **US1 (P1)**: depends on Foundational (T002, T006→T007).
- **US2 (P1)**: independent; touches same `schemas.ts`/`service.ts` as US1 — sequence T010 after T006/T007 to avoid file conflicts.
- **US5 (P1)**: independent (addresses tests + countries parity); no code change expected.
- **US3 (P2)**: depends only on T003 doc rule; test is self-contained.
- **US4 (P2)**: fully independent.

### Within Each User Story

- Tests written first and must FAIL before implementation (Principle VI).
- Schema change (T006) before service wiring (T007).

### Parallel Opportunities

- T002 ∥ T003 (T003 is `[P]`, same file — apply T002 first, then T003, or do as one edit).
- All test tasks across stories are `[P]` (distinct files: `registry.test.ts`, `service.test.ts`, `addresses/service.test.ts`).
- US3, US4, US5 work can proceed in parallel with US1/US2 once Foundational done.

---

## Parallel Example: tests-first batch

```bash
# After Foundational (T002, T003), author failing tests in parallel:
Task: "T004 hashCountryFields determinism/isolation in registry.test.ts"
Task: "T009 payload completeness per country in service.test.ts"
Task: "T011 submit gate rejections in addresses/service.test.ts"
Task: "T014 pattern safety guard in registry.test.ts"
Task: "T016 country list completeness in service.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 baseline green.
2. T002–T003 foundational hash + doc.
3. T004–T008 US1: failing tests → schema → service → barrel.
4. **STOP & VALIDATE**: version stable + content-derived. Deploy/demo.

### Incremental Delivery

US1 (version) → US2 (completeness) → US5 (server gate) → US3 (pattern safety) → US4 (list). Each adds/guards value without breaking prior.

---

## Notes

- Most US2/US4/US5 implementation tasks are expected no-ops (behavior already present) — their value is the test/guard that locks the contract.
- `[P]` = different files, no dependency. Within `service.ts`/`schemas.ts` keep edits sequential.
- Commit after each task or logical group. No DB migration in this feature.
