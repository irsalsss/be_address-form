# Contract: GET /api/v1/countries

Returns the list of supported countries for the country selector. Unchanged by this feature — documented here to confirm the contract (FR-011).

## Request

- **Method/Path**: `GET /api/v1/countries`
- No params.

## Response 200 (application/json)

```json
{
  "countries": [
    { "code": "USA", "name": "United States" },
    { "code": "AUS", "name": "Australia" },
    { "code": "IDN", "name": "Indonesia" }
  ]
}
```

### Guarantees
- Every supported country appears, each with a non-empty `code` and `name` (FR-011, SC-006).
- No `version` here — versioning is per-country-layout and lives on the fields endpoint (see [countries-fields.md](./countries-fields.md)).
