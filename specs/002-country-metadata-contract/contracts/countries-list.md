# Contract: GET /api/v1/countries

Returns the list of supported countries for the country selector. Unchanged by this feature — documented here to confirm the contract (FR-011).

## Request

- **Method/Path**: `GET /api/v1/countries`
- No params.

## Response 200 (application/json)

```json
{
  "countries": [
    { "code": "USA", "name": "United States", "version": "sha256:1a2b3c4d5e6f7a8b" },
    { "code": "AUS", "name": "Australia",     "version": "sha256:..." },
    { "code": "IDN", "name": "Indonesia",     "version": "sha256:..." }
  ]
}
```

### Guarantees
- Every supported country appears, each with a non-empty `code` and `name` (FR-011, SC-006).
- `version` is the same content-derived token as the fields endpoint (see [countries-fields.md](./countries-fields.md)) for that country. Exposed here so a client can build its per-country cache key from the list alone, without a round-trip to `/fields` first (FR-001). Identical value for identical field definitions across requests/restarts; changes only when the country's definitions change.
