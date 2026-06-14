# Contract: GET /api/v1/countries/:code/fields

Returns the full field metadata for one country so a client can render a form and build a matching validation schema with no local country data.

## Request

- **Method/Path**: `GET /api/v1/countries/{code}/fields`
- **Path param** `code`: country code; accepts canonical alpha-3 (`USA`/`AUS`/`IDN`) or alias alpha-2 (`US`/`AU`/`ID`), case-insensitive (FR-015).

## Response 200 (application/json)

```json
{
  "code": "USA",
  "name": "United States",
  "version": "sha256:1a2b3c4d5e6f7a8b",
  "fields": [
    { "key": "line1", "label": "Address Line 1", "required": true,  "type": "text",     "order": 0 },
    { "key": "line2", "label": "Address Line 2", "required": false, "type": "text",     "order": 1 },
    { "key": "city",  "label": "City",           "required": true,  "type": "text",     "order": 2 },
    { "key": "state", "label": "State",          "required": true,  "type": "dropdown",
      "options": [{ "value": "AL", "label": "AL" }, { "value": "AK", "label": "AK" }],
      "order": 3 },
    { "key": "zip",   "label": "ZIP Code",       "required": true,  "type": "text",
      "validation": { "length": 5, "numeric": true }, "order": 4 }
  ]
}
```

### Field contract guarantees
- Every field has `key`, `label` (English), `required`, `type`, `order` (FR-005).
- `type: "dropdown"` → `options` present with full `{value,label}` list (FR-006).
- Fields with constraints carry `validation` (`length` | `numeric` | `maxLength` | `pattern`) (FR-007).
- `validation.pattern`, when present: bare regex source, no delimiters/flags, JSON-round-trip-stable, no catastrophic backtracking (FR-008/009/010).
- `version`: content-derived; identical for identical field definitions across requests/restarts; changes when definitions change; per-country independent (FR-001/002/003/004).
- `fields` are returned in display order; `order` equals array index.

## Response 404 (application/problem+json)

Unsupported country code → RFC 7807 problem, `status: 404`, `code: "NOT_FOUND"` (FR-015, existing behavior).

## Backward compatibility

Additive only: `version` is a new top-level field. Existing consumers reading `code`/`name`/`fields` are unaffected.
