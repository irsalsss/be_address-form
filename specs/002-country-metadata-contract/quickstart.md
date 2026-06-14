# Quickstart / Validation Guide: Country-Metadata Contract

How to verify the hardened metadata contract end-to-end. Implementation details live in `tasks.md` and the code.

## Prerequisites

- Node 24, pnpm (corepack), deps installed (`pnpm install`)
- Local Postgres for submit-path checks: `docker compose up -d db`
- Dev server: `pnpm dev` (port 4000) — for manual curl checks
- Tests: `pnpm test:ci`

## Scenario 1 — Version present, stable, and content-derived (US1)

Fetch fields twice; `version` identical.

```bash
curl -s localhost:4000/api/v1/countries/USA/fields | jq .version
curl -s localhost:4000/api/v1/countries/USA/fields | jq .version   # same value
```

Automated (unit): assert `getCountryFields("USA").version === getCountryFields("USA").version`; assert it has the `sha256:` prefix; assert a temporary change to a country's `fields` (in a test fixture/clone) changes the hash while another country's hash is unchanged.

**Expected**: identical version across calls and restarts (SC-002); changes only on field-def change; per-country independent (SC-003).

## Scenario 2 — Payload is complete enough to render + validate (US2)

```bash
curl -s localhost:4000/api/v1/countries/IDN/fields | jq '.fields[] | {key,label,required,type,order, hasOptions:(.options!=null), hasValidation:(.validation!=null)}'
```

**Expected**: every field has `key,label,required,type,order`; dropdown fields have full `options`; constrained fields have `validation` (SC-001). Verify alias: `…/countries/id/fields` returns the same payload and version as `…/IDN/fields`.

## Scenario 3 — Patterns are safe (US3)

Registry-wide unit test over `listCountryEntries()`:
- every `validation.pattern` compiles via `new RegExp(src)`,
- equals `JSON.parse(JSON.stringify(src))`,
- passes the catastrophic-backtracking heuristic guard.

**Expected**: 100% pass (SC-004). (No country uses `pattern` today; the test guards future additions.)

## Scenario 4 — Country list drives the dropdown (US4)

```bash
curl -s localhost:4000/api/v1/countries | jq '.countries'
```

**Expected**: all supported countries with non-empty `code` + `name` (SC-006).

## Scenario 5 — Server is the authoritative gate (US5)

```bash
# unknown key rejected
curl -s -X POST localhost:4000/api/v1/addresses -H 'content-type: application/json' \
  -d '{"country":"USA","fields":{"line1":"1 A St","city":"NY","state":"NY","zip":"10001","bogus":"x"}}' | jq .status   # 400

# rule violation rejected (zip wrong length)
curl -s -X POST localhost:4000/api/v1/addresses -H 'content-type: application/json' \
  -d '{"country":"USA","fields":{"line1":"1 A St","city":"NY","state":"NY","zip":"123"}}' | jq .status   # 400
```

**Expected**: unknown fields, rule violations, and missing required fields all rejected with 400 problem+json (SC-005). Covered by `addresses/service.test.ts` against real Postgres.

## Gate

All green when `pnpm lint`, `pnpm type-check`, `pnpm test:ci` pass and `/docs` shows `version` on the fields response schema.
