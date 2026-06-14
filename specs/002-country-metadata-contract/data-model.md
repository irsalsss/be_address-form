# Phase 1 Data Model: Country-Metadata Contract

No persistence change. This documents the in-code registry types and the API DTOs. The DB (`addresses`: `country_code` + `fields` jsonb) is untouched (FR-016).

## Source-of-truth types (registry.ts)

### Country
| Field | Type | Notes |
|---|---|---|
| `code` | `CountryCode` (`"USA" \| "AUS" \| "IDN"`) | canonical alpha-3 |
| `name` | `string` | English display name |
| `fields` | `CountryFieldDef[]` | declared order = display order |

### CountryFieldDef
| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | `string` | yes | submission key; unique within country |
| `label` | `string` | yes | English label |
| `required` | `boolean` | yes | drives `.optional()` in submit schema |
| `type` | `"text" \| "dropdown"` | yes | |
| `options` | `FieldOption[]` | dropdown only | full value/label list |
| `validation` | `FieldValidation` | optional | constraints |

### FieldOption
| Field | Type | Notes |
|---|---|---|
| `value` | `string` | stored/submitted value |
| `label` | `string` | displayed text |

### FieldValidation
| Field | Type | Notes |
|---|---|---|
| `length` | `number` (int > 0) | exact char length (e.g. ZIP = 5) |
| `numeric` | `boolean` | digits-only |
| `pattern` | `string` | **bare regex source**, no delimiters/flags; JSON-safe; no catastrophic backtracking (FR-008/009/010). Overrides length/numeric when present. |
| `maxLength` | `number` (int > 0) | max length for free text (default 200) |

**Validation rule precedence (submit-time `fieldSchema`)**: `dropdown` → enum over option values; else `pattern` → regex; else `numeric`/`length` → derived `^\d{n}$` / `^\d+$` / `^.{n}$`; else free text trimmed, min 1, max `maxLength ?? 200`. `required: false` wraps in `.optional()`.

## API DTOs (schemas.ts)

### CountrySummary — `GET /api/v1/countries` items
| Field | Type |
|---|---|
| `code` | `string` |
| `name` | `string` |

Response: `{ countries: CountrySummary[] }` (FR-011).

### FieldDefDto — items in fields response
Mirrors `CountryFieldDef` plus a derived `order`:
| Field | Type | Source |
|---|---|---|
| `key` | `string` | field.key |
| `label` | `string` | field.label |
| `required` | `boolean` | field.required |
| `type` | `"text" \| "dropdown"` | field.type |
| `options` | `FieldOption[]?` | field.options |
| `validation` | `FieldValidation?` | field.validation |
| `order` | `number` (int ≥ 0) | array index |

### CountryFieldsResponse — `GET /api/v1/countries/:code/fields`
| Field | Type | Status |
|---|---|---|
| `code` | `string` | existing |
| `name` | `string` | existing |
| `version` | `string` | **NEW** — content hash, e.g. `sha256:1a2b3c4d5e6f7a8b` (FR-001) |
| `fields` | `FieldDefDto[]` | existing |

## Derived value: Field Metadata Version

- **Definition**: `version = "sha256:" + sha256(canonicalJson(country.fields)).slice(0,16)`
- **Canonical input**: fields in declared order; per-field keys emitted in fixed order (`key, label, required, type, options, validation`); `options`/`validation` sub-keys fixed-ordered; absent optionals omitted (not `undefined`).
- **Invariants**:
  - Pure function of field-definition content (FR-004).
  - Changes iff content changes — incl. add/remove/reorder/relabel/required-toggle/options/validation (FR-002).
  - Independent per country (FR-003).
  - Alias-invariant: requesting `US` vs `USA` yields the same country → same version (FR-015).
