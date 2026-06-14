# Feature Specification: Harden the Country-Metadata Contract

**Feature Branch**: `002-country-metadata-contract`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Harden the country-metadata contract so the frontend can render and validate entirely from it. Add a version field (deterministic hash of a country's field definitions) to the fields endpoint; guarantee the payload carries everything the client needs (key, label, required, type, options, validation, order); ensure validation.pattern is a JSON-safe, client-compilable regex source with no catastrophic backtracking; confirm the country list returns code + name; keep the submit validator authoritative (.strict, registry-derived). No DB schema change. Out of scope: moving the registry into a database/admin UI; changing field contents of existing countries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cache and invalidate field metadata by version (Priority: P1)

A frontend developer fetches a country's field metadata once, caches it, and on later visits avoids re-rendering work unless the layout actually changed. The fields response carries a `version` identifier that changes only when that country's field definitions change.

**Why this priority**: This is the new capability the feature exists to deliver. Without a stable version identifier, the client cannot safely cache metadata or know when to invalidate, which blocks the frontend's move to render and validate purely from this metadata.

**Independent Test**: Fetch the fields endpoint for a country twice and confirm an identical `version`. Then change that country's field definitions and confirm the `version` changes; confirm a different country's `version` is unaffected.

**Acceptance Scenarios**:

1. **Given** a supported country, **When** the client requests its field metadata twice without any registry change, **Then** the `version` value is identical across both responses.
2. **Given** a supported country, **When** that country's field definitions change (a field added, removed, reordered, relabeled, or its validation/options altered), **Then** the returned `version` differs from the previous value.
3. **Given** two supported countries, **When** one country's field definitions change, **Then** the other country's `version` is unchanged.

---

### User Story 2 - Render and pre-validate a form from one payload (Priority: P1)

A frontend developer builds a complete, country-specific form and a matching client-side validation schema using only the single fields payload — no locally bundled country data. Every field carries its key, human-readable label, required flag, input type, dropdown options (when applicable), validation rules, and display order.

**Why this priority**: The stated goal is for the client to render and validate entirely from metadata. If any piece (label, options, validation, order) is missing, the client must hardcode it, defeating the single-source-of-truth design.

**Independent Test**: For each supported country, fetch the fields payload and confirm that every field needed to build the form and a client validation schema is fully described — label present, required flag present, type present, dropdown fields include the full option list, fields with constraints include those constraints, and every field has an order.

**Acceptance Scenarios**:

1. **Given** any supported country, **When** the client fetches its field metadata, **Then** each field includes `key`, `label` (English), `required`, `type`, and `order`.
2. **Given** a dropdown field, **When** the client fetches the metadata, **Then** the field includes the complete list of selectable options, each with a value and a display label.
3. **Given** a field with constraints (fixed length, numeric-only, max length, or pattern), **When** the client fetches the metadata, **Then** those constraints are present so the client can build a matching validation rule.
4. **Given** the full payload for a country, **When** the client orders fields by `order`, **Then** the order matches the intended display sequence.

---

### User Story 3 - Compile server-provided patterns safely on the client (Priority: P2)

A frontend developer compiles any `validation.pattern` from the metadata directly into a client-side regular expression without escaping surprises or risk of a pathological (catastrophic-backtracking) pattern hanging the browser.

**Why this priority**: Patterns are the one validation rule that the client must execute as code. An unsafe or non-portable pattern source would break client validation or create a denial-of-service risk in the browser, but it only applies to fields that carry a pattern.

**Independent Test**: For every field across all countries that exposes a `validation.pattern`, confirm the pattern is a plain regex source string that compiles on the client, survives a JSON round-trip unchanged, and is free of constructs known to cause catastrophic backtracking.

**Acceptance Scenarios**:

1. **Given** a field whose metadata includes `validation.pattern`, **When** the client reads the value, **Then** it is a regex source string (no surrounding delimiters or flags) that compiles into a regular expression.
2. **Given** a `validation.pattern` value, **When** it is serialized and parsed as JSON, **Then** the string is unchanged and still compiles to the same pattern.
3. **Given** the set of all exposed patterns, **When** each is inspected, **Then** none contains nested unbounded quantifiers or other constructs known to cause catastrophic backtracking.

---

### User Story 4 - Populate the country dropdown (Priority: P2)

A frontend developer populates the country selector from the country list endpoint, which returns each supported country's code and display name.

**Why this priority**: The list drives the entry point of the flow (pick a country), but it is a confirmation of existing behavior rather than new capability.

**Independent Test**: Fetch the country list and confirm each entry has a code and a name and that every supported country appears.

**Acceptance Scenarios**:

1. **Given** the country list endpoint, **When** the client fetches it, **Then** every supported country is returned with a `code` and a `name`.

---

### User Story 5 - Server remains the authoritative validation gate (Priority: P1)

The server re-validates every submission against the same registry that produced the metadata. Unknown fields and values that violate a field's rules are rejected regardless of what the client did.

**Why this priority**: Client-side validation is an optimization for UX; trust still lives on the server. The hardened metadata contract must not weaken the server gate — client and server rules must stay derived from the same source.

**Independent Test**: Submit a payload containing an unknown field, and separately a payload that violates a field rule (e.g. wrong length, invalid dropdown value, missing required field), and confirm each is rejected with a validation error.

**Acceptance Scenarios**:

1. **Given** a submission with a field key not defined for the country, **When** it is submitted, **Then** the server rejects it with a validation error.
2. **Given** a submission whose value violates a field's stated rule (length, numeric, pattern, dropdown membership, or a missing required field), **When** it is submitted, **Then** the server rejects it with a validation error.
3. **Given** the metadata served to the client and the server's submit-time validation, **When** both are compared for a country, **Then** they enforce the same per-field rules (same source of truth).

---

### Edge Cases

- **Unsupported / unknown country code** on the fields endpoint: returns a not-found error (existing behavior, preserved).
- **Country-code aliasing** (e.g. alpha-2 vs alpha-3 input): the same country resolves to the same metadata and the same `version` regardless of which accepted alias was used to request it.
- **Field with no validation block** (free-text with default bounds): metadata still describes the field fully; absence of explicit constraints is itself meaningful to the client.
- **Optional field** absent from a submission: accepted by the server (not treated as a violation).
- **Empty or whitespace-only required value**: rejected by the server.
- **Version stability across process restarts**: the same registry content yields the same `version` after a restart (the version is a function of content, not of runtime state).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fields metadata response for a country MUST include a `version` identifier derived deterministically from that country's field definitions.
- **FR-002**: The `version` MUST change when, and only when, the country's field definitions change (including additions, removals, reordering, label changes, required-flag changes, option-set changes, and validation-rule changes).
- **FR-003**: A change to one country's field definitions MUST NOT change another country's `version`.
- **FR-004**: The `version` MUST be stable across repeated requests and process restarts for unchanged field definitions (a pure function of content).
- **FR-005**: Each field in the metadata MUST include its `key`, English `label`, `required` flag, input `type`, and display `order`.
- **FR-006**: Each dropdown field's metadata MUST include the complete list of selectable options, each with a `value` and a display `label`.
- **FR-007**: Each field that has constraints MUST expose them in `validation`, covering fixed length, numeric-only, maximum length, and pattern as applicable.
- **FR-008**: When present, `validation.pattern` MUST be a plain regular-expression source string (no delimiters or flags) that a client can compile directly.
- **FR-009**: When present, `validation.pattern` MUST survive a JSON serialization round-trip unchanged.
- **FR-010**: Any exposed `validation.pattern` MUST be free of constructs known to cause catastrophic backtracking, and this rule MUST be documented for future pattern authors.
- **FR-011**: The country list response MUST return each supported country's `code` and display `name`, covering all supported countries.
- **FR-012**: The metadata served to clients and the server's submit-time validation MUST be derived from the same single source so they enforce identical per-field rules.
- **FR-013**: The submit-time validator MUST reject submissions containing field keys not defined for the country.
- **FR-014**: The submit-time validator MUST reject values that violate a field's stated rule (length, numeric, pattern, dropdown membership) and MUST reject missing required fields.
- **FR-015**: A request for the fields metadata of an unsupported country MUST return a not-found error; the same country requested via any accepted code alias MUST return identical metadata and an identical `version`.
- **FR-016**: The persisted address shape MUST remain unchanged (country code plus a free-form fields document); this feature introduces no database schema change.

### Key Entities *(include if data involved)*

- **Country**: A supported country. Attributes: code, display name, an ordered set of field definitions. Identified to clients by code; carries a content-derived version for its fields.
- **Field Definition**: One input in a country's form. Attributes: key, label, required flag, type (text or dropdown), optional options list, optional validation rules, display order.
- **Field Option**: A selectable choice for a dropdown field. Attributes: value (stored/submitted) and label (displayed).
- **Field Validation**: Constraints for a field. Attributes: fixed length, numeric-only flag, maximum length, regex pattern source — each optional.
- **Field Metadata Version**: A content-derived identifier for a country's field definitions, used by clients for cache validation and invalidation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can render a complete, correct form and a matching pre-submit validation for any supported country using only the two metadata endpoints (country list + that country's fields) — with zero locally bundled country data.
- **SC-002**: For unchanged field definitions, repeated fetches of a country's metadata return the identical `version` value 100% of the time, including across process restarts.
- **SC-003**: Any change to a country's field definitions changes that country's `version` and leaves every other country's `version` unchanged, in 100% of cases.
- **SC-004**: 100% of exposed `validation.pattern` values compile to a regular expression on the client, are unchanged by a JSON round-trip, and pass a catastrophic-backtracking safety check.
- **SC-005**: 100% of submissions containing an unknown field or a value that violates a field rule (or omitting a required field) are rejected by the server, independent of client behavior.
- **SC-006**: The country list returns every supported country with a non-empty code and name.

## Assumptions

- The country registry remains the single in-code source of truth for this feature; moving it into a database or admin UI is explicitly out of scope.
- Field contents of existing countries are not being changed by this feature; the `version` and payload-completeness guarantees are added around the current definitions.
- "JSON-safe regex source" means the standard JSON string escaping applies and the value is consumed as a regex source (without surrounding `/.../` delimiters or flags); the client owns flag selection and compilation.
- The set of validation rule kinds remains: fixed length, numeric-only, maximum length, and pattern. No new validation rule kinds are introduced.
- English is the language for field labels in this iteration; localization is out of scope.
- The `version` identifier is for cache validation/invalidation, not for security or integrity guarantees, so a fast deterministic content hash is sufficient.
- The two metadata endpoints and the submit endpoint already exist; this feature hardens their contract rather than introducing new endpoints (apart from the added `version` field).
