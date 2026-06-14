# Feature Specification: Country-Aware Address Capture API

**Feature Branch**: `001-address-capture-api`

**Created**: 2026-06-14

**Status**: Draft

**Input**: AcmeCorp customer onboarding collects user addresses. Addresses vary by
country, so the system needs a backend that (1) serves the field layout and
validation rules for each supported country, (2) accepts and stores a captured
address, and (3) returns saved addresses for demo/retrieval. Supported countries
at launch: United States (USA), Australia (AUS), Indonesia (IDN). Scope here is
**backend only**; the frontend dynamic form is a consumer of these APIs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a captured address (Priority: P1)

During onboarding a user selects their country and submits an address (either
from autocomplete or manual entry). The backend validates the submission against
that country's rules and persists it, returning a stable identifier for the
stored record.

**Why this priority**: This is the core purpose of the feature — without
persistence there is nothing to demo and no captured data. It is the minimum
viable slice: a single endpoint that accepts and stores a valid address.

**Independent Test**: Submit a valid USA address payload; confirm a 201-style
success with a returned record id, and that the record can be read back. Submit
an invalid payload (e.g. missing required City) and confirm rejection with a
field-level error.

**Acceptance Scenarios**:

1. **Given** a valid USA address (line1, city, state, 5-digit ZIP), **When** the
   user submits it, **Then** the system stores it and returns a record with a
   unique id and the normalized address.
2. **Given** an Australia address missing the required Suburb, **When** the user
   submits it, **Then** the system rejects it with a validation error naming the
   missing field and stores nothing.
3. **Given** an Indonesia address with a 4-digit Postal Code (5 required),
   **When** the user submits it, **Then** the system rejects it with a
   validation error identifying the invalid field.
4. **Given** an address whose country is not supported, **When** the user
   submits it, **Then** the system rejects it as an unsupported country.

---

### User Story 2 - Retrieve saved addresses (Priority: P2)

For demo and verification, a saved address can be retrieved — both as a list of
all captured addresses and as a single record by its identifier.

**Why this priority**: Required by the brief ("API to retrieve saved addresses
for demo purposes") and needed to prove persistence works, but depends on
Story 1 existing first.

**Independent Test**: After saving two addresses, call the list endpoint and
confirm both appear; call the single-record endpoint with a known id and confirm
the correct record returns; call it with an unknown id and confirm a not-found
response.

**Acceptance Scenarios**:

1. **Given** two saved addresses, **When** the list is requested, **Then** both
   records are returned with their country and stored fields.
2. **Given** a known record id, **When** that record is requested, **Then** the
   matching address is returned.
3. **Given** an id that does not exist, **When** that record is requested,
   **Then** the system returns a not-found result.

---

### User Story 3 - Fetch country field layouts and validation rules (Priority: P2)

The frontend needs to render the correct fields per country and validate input
before submission. The backend exposes the supported countries and, per country,
the ordered list of fields with their labels, required/optional status, input
type (text vs dropdown), dropdown option sets, and validation rules (e.g. postal
code length/pattern). This is the "dynamic country-specific metadata" capability.

**Why this priority**: This is the bonus/differentiator and the source of truth
that keeps client and server validation aligned. It is P2 because Story 1 can
ship with country rules enforced server-side even before the metadata is
publicly served, but the dynamic form depends on it.

**Independent Test**: Request the metadata for `IDN` and confirm it returns the
Province dropdown options, the required District (Kecamatan) field, the optional
Village field, and a 5-digit postal code rule — in the field order defined for
Indonesia. Request metadata for an unsupported country and confirm a not-found.

**Acceptance Scenarios**:

1. **Given** the supported-countries request, **When** it is made, **Then** the
   system returns USA, AUS, and IDN with display names and country codes.
2. **Given** a request for USA metadata, **When** it is made, **Then** the system
   returns fields in order: Address Line 1 (required), Address Line 2 (optional),
   City (required), State (dropdown of US states), ZIP Code (required, 5 digits).
3. **Given** a request for AUS metadata, **When** it is made, **Then** the system
   returns the State dropdown limited to NSW, VIC, QLD, WA, SA, TAS, ACT, NT and
   a Postcode rule of 4 digits.
4. **Given** the validation rules returned for a country, **When** an address is
   later submitted, **Then** the server enforces those same rules (client and
   server rules do not diverge).

---

### Edge Cases

- Submission includes fields that do not belong to the selected country's layout
  (e.g. a US `state` value on an Indonesian address) → extra/unknown fields are
  rejected or ignored per a defined rule, never silently stored as valid.
- Dropdown value outside the allowed set (e.g. state `ZZ` for USA, province not
  in the Indonesian list) → rejected with a field-level error.
- Postal/ZIP code with correct length but non-numeric characters → rejected.
- Required field present but empty/whitespace-only → treated as missing.
- Country code submitted in inconsistent casing (`us` vs `USA`) → normalized to
  the canonical code before validation, or rejected if not resolvable.
- Optional field omitted entirely → accepted; stored as absent, not as empty
  string.
- Very large or malformed request body → rejected before validation logic runs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose the list of supported countries, each with a
  canonical country code and a human-readable display name.
- **FR-002**: System MUST expose, per supported country, the ordered set of
  address fields including for each field: a stable key, a display label,
  required-or-optional status, input type (free text or dropdown), allowed option
  set for dropdowns, and validation constraints (e.g. exact digit length,
  numeric-only).
- **FR-003**: System MUST accept an address submission that specifies the country
  and the captured field values.
- **FR-004**: System MUST validate every submission against the selected
  country's rules before storing it, rejecting submissions that fail with errors
  that identify the offending field(s).
- **FR-005**: System MUST enforce required fields per country: USA (line1, city,
  state, ZIP), AUS (line1, suburb, state, postcode), IDN (province, city/regency,
  district, postal code, street address).
- **FR-006**: System MUST enforce dropdown value membership: USA state in the US
  state set, AUS state in {NSW, VIC, QLD, WA, SA, TAS, ACT, NT}, IDN province in
  the defined province set.
- **FR-007**: System MUST enforce postal-code formats: USA ZIP = 5 digits, AUS
  postcode = 4 digits, IDN postal code = 5 digits.
- **FR-008**: System MUST reject submissions for countries that are not in the
  supported set.
- **FR-009**: System MUST persist each accepted address with a unique, stable
  identifier and a creation timestamp.
- **FR-010**: System MUST return the stored record (including its id) in the
  response to a successful submission.
- **FR-011**: Users MUST be able to retrieve the list of all saved addresses.
- **FR-012**: Users MUST be able to retrieve a single saved address by its
  identifier, with a not-found result when no such record exists.
- **FR-013**: System MUST return validation failures in a consistent,
  machine-readable shape that distinguishes the failing field(s) from other error
  types (not-found, unsupported country).
- **FR-014**: The validation rules served via the metadata API (FR-002) MUST be
  the same rules enforced on submission (FR-004) — a single source of truth.
- **FR-015**: System MUST store both the country-common fields and the
  country-specific fields such that a saved record can be read back with the same
  field semantics it was submitted with.
- **FR-016**: Adding a new supported country MUST be achievable by extending the
  country metadata/configuration, without changing the submit or retrieve flow
  logic.

### Key Entities *(include if feature involves data)*

- **Country**: A supported country. Attributes: canonical code (e.g. USA, AUS,
  IDN), display name. Anchors the field layout and validation rules.
- **Country Field Definition**: One field within a country's layout. Attributes:
  field key, label, required flag, input type (text/dropdown), allowed options
  (for dropdowns), validation constraints (length, numeric, etc.), display order.
- **Address**: A captured address record. Attributes: unique id, country code,
  the set of submitted field values (common + country-specific), creation
  timestamp. Related to exactly one Country.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid address for any supported country is saved and retrievable
  by its id with 100% field fidelity (what was submitted is what is read back).
- **SC-002**: 100% of submissions that violate a country's required-field,
  dropdown-membership, or postal-code rule are rejected and never stored.
- **SC-003**: The validation rules a client receives from the metadata API
  produce the same accept/reject decision as the server for the same input in
  100% of tested cases (no client/server divergence).
- **SC-004**: A new country can be added and fully functional (metadata served +
  submissions validated and stored) by editing configuration only, with no change
  to submit/retrieve flow logic.
- **SC-005**: Each of the three launch countries (USA, AUS, IDN) has explicit
  automated coverage for accept and reject paths of its required fields, dropdown
  sets, and postal-code format.
- **SC-006**: A retrieval request for a non-existent address id returns a
  not-found outcome distinct from an empty-list success.

## Assumptions

- Scope is backend only: the API surface (country metadata, submit address,
  retrieve addresses). The frontend dynamic form, Google Places autocomplete, and
  any maps/places API integration are out of scope for this spec and consume
  these APIs.
- No authentication/authorization is required for this demo; endpoints are open.
  (If that is wrong, it becomes a follow-up before production.)
- Google Places autocomplete is a frontend concern; the backend stores whatever
  final field values the client submits and does not call a places service.
- The US state set is the standard 50 states (plus DC); the exact enumerated list
  is a configuration detail authored during planning.
- The Indonesian province set is the official province list; the brief's
  examples (Jawa Barat, Bali, Sumatra Utara) are a subset, and the full list is a
  configuration detail.
- Addresses are stored individually and are not deduplicated or linked to a user
  account in this demo; "retrieve all" returns every captured record.
- Persistence uses the project's standard datastore; in-memory/SQLite-style
  storage mentioned in the brief is treated as an implementation choice deferred
  to planning, not a spec constraint.
- Standard web API performance and error-handling expectations apply; no special
  scale target is stated for this demo.
