# Quickstart: Country-Aware Address Capture API

Validation guide proving the feature end-to-end. Implementation detail lives in
`tasks.md`; this is the run/verify path.

## Prerequisites

- Node 24, pnpm (corepack), Docker (for Postgres)
- Deps installed: `pnpm install`

## Setup

```bash
docker compose up -d db        # local Postgres 17 (port 5432, app/app/app)
pnpm db:generate               # generate the addresses-table migration
pnpm db:migrate                # apply it
pnpm dev                       # tsx watch, serves on :4000
```

Open `http://localhost:4000/docs` (dev only) to see the generated OpenAPI.

## Validation scenarios

Endpoints are under `/api/v1`. See [contracts/openapi.yaml](./contracts/openapi.yaml)
and [data-model.md](./data-model.md) for shapes.

### 1. Country metadata is served (US Story 3 / FR-001, FR-002)

```bash
curl -s localhost:4000/api/v1/countries
# → { "countries": [ {code:USA,...}, {code:AUS,...}, {code:IDN,...} ] }

curl -s localhost:4000/api/v1/countries/IDN/fields
# → fields in order: province(dropdown), city(req), district(req),
#   village(optional), postalCode(req,5-digit), street(req)
```

Expected: AUS state options are exactly NSW,VIC,QLD,WA,SA,TAS,ACT,NT; USA zip
shows validation length 5; unsupported code (e.g. `/countries/XX/fields`) → 404
problem+json.

### 2. Save a valid address (US Story 1 / FR-003, FR-009, FR-010, SC-001)

```bash
curl -s -X POST localhost:4000/api/v1/addresses \
  -H 'content-type: application/json' \
  -d '{"country":"USA","fields":{"line1":"1 Infinite Loop","city":"Cupertino","state":"CA","zip":"95014"}}'
# → 201 { id, country:"USA", fields:{...}, createdAt }
```

Expected: returns a uuid `id`; `fields` read back identical to submitted.

### 3. Reject invalid submissions (US Story 1 / FR-004..FR-008, SC-002)

```bash
# missing required suburb (AUS)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:4000/api/v1/addresses \
  -H 'content-type: application/json' \
  -d '{"country":"AUS","fields":{"line1":"x","state":"NSW","postcode":"2000"}}'
# → 400

# IDN postal code 4 digits (5 required)
# → 400, problem+json names the failing field

# unknown dropdown value (USA state ZZ) → 400
# unsupported country → 400
# extra unknown field (.strict) → 400
```

### 4. Retrieve saved addresses (US Story 2 / FR-011, FR-012, SC-006)

```bash
curl -s localhost:4000/api/v1/addresses           # list all
curl -s localhost:4000/api/v1/addresses/<id>       # by id → 200
curl -s -o /dev/null -w '%{http_code}\n' \
  localhost:4000/api/v1/addresses/00000000-0000-0000-0000-000000000000
# → 404 (distinct from empty-list 200)
```

### 5. Client/server rule parity (FR-014 / SC-003)

For each country, the `validation` + dropdown `options` returned by
`/countries/{code}/fields` must produce the same accept/reject decision as POST
`/addresses` for the same input. Covered by automated tests asserting both paths
share the registry.

## Test run

```bash
pnpm test:ci      # vitest run — per-country accept+reject, repository (real PG)
pnpm lint
pnpm type-check
```

Expected: green. Each launch country has accept + reject coverage for required
fields, dropdown membership, and postal-code format (SC-005).
