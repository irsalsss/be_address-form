# Phase 1 Data Model: Country-Aware Address Capture API

## Persisted entity

### `addresses` (Postgres table, Drizzle)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default uuidv7 | stable record identifier |
| `country_code` | `varchar(3)` | not null | canonical code: `USA`/`AUS`/`IDN` |
| `fields` | `jsonb` | not null | full submitted field set, key→value (Decision 2) |
| `created_at` | `timestamptz` | not null, default `now()` | ordering for list |

- Index: `created_at` (desc) for list ordering. Optional index on
  `country_code` for filtered retrieval (not required by current endpoints).
- `fields` holds exactly the validated, country-specific keys (e.g. USA →
  `{ line1, line2?, city, state, zip }`). No empty strings stored for omitted
  optional fields.

## In-code entities (not persisted)

### `Country` (registry entry)

| Attribute | Type | Notes |
|---|---|---|
| `code` | `'USA' \| 'AUS' \| 'IDN'` | canonical, upper-case |
| `name` | string | display name |
| `fields` | `CountryFieldDef[]` | ordered, drives metadata + validator |

### `CountryFieldDef`

| Attribute | Type | Notes |
|---|---|---|
| `key` | string | stable field key, used in `fields` JSON and validator |
| `label` | string | human label for the form |
| `required` | boolean | required vs optional |
| `type` | `'text' \| 'dropdown'` | input type |
| `options?` | `{ value: string; label: string }[]` | present iff `type === 'dropdown'` |
| `validation?` | `{ length?: number; numeric?: boolean; pattern?: string }` | e.g. ZIP length 5 numeric |
| `order` | number | display order (or array index) |

## Country field layouts (launch set)

### USA
1. `line1` — Address Line 1 — required — text
2. `line2` — Address Line 2 — optional — text
3. `city` — City — required — text
4. `state` — State — required — dropdown (50 states + DC)
5. `zip` — ZIP Code — required — text — `{ length: 5, numeric: true }`

### AUS
1. `line1` — Address Line 1 — required — text
2. `line2` — Address Line 2 — optional — text
3. `suburb` — Suburb — required — text
4. `state` — State — required — dropdown `[NSW, VIC, QLD, WA, SA, TAS, ACT, NT]`
5. `postcode` — Postcode — required — text — `{ length: 4, numeric: true }`

### IDN
1. `province` — Province — required — dropdown (official province list)
2. `city` — City / Regency — required — text
3. `district` — District (Kecamatan) — required — text
4. `village` — Village (Kelurahan/Desa) — optional — text
5. `postalCode` — Postal Code — required — text — `{ length: 5, numeric: true }`
6. `street` — Street Address — required — text

## Derivation rules (registry → outputs)

- **Metadata response** = country `fields` projected to
  `{ key, label, required, type, options, validation, order }`.
- **Submit validator** (Zod, per country, `.strict()`):
  - required text → `z.string().trim().min(1)`
  - optional text → `z.string().trim().min(1).optional()` (omitted ≠ empty)
  - dropdown → `z.enum(options.map(o => o.value))` (required/optional as above)
  - numeric+length → `.regex(/^\d{N}$/)`
- Same field defs feed both → client and server decisions match (FR-014/SC-003).

## Validation → requirement mapping

| Rule | Requirements |
|---|---|
| Required fields per country | FR-005 |
| Dropdown membership | FR-006 |
| Postal/ZIP format | FR-007 |
| Unsupported country rejected | FR-008 |
| Unknown extra field rejected (`.strict()`) | edge cases, SC-002 |
| Read-back fidelity (JSONB) | FR-015, SC-001 |
| Add country by config | FR-016, SC-004 |
