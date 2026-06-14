# Phase 0 Research: Country-Metadata Contract Hardening

No open `NEEDS CLARIFICATION` items remained from the spec. Research below records the technical decisions that shape Phase 1.

## R1. Version hash algorithm and input

**Decision**: Compute `version` as a SHA-256 hex digest (truncated to 16 hex chars) of a **canonical JSON serialization** of the country's `fields` array, using `node:crypto` (`createHash`). Serialization walks fields in their declared order and, within each field, emits keys in a fixed order (`key, label, required, type, options, validation`), with `options` and `validation` sub-keys also fixed-ordered. Prefix the value with `sha256:` (e.g. `sha256:1a2b3c…`) for self-description.

**Rationale**:
- Pure function of content → identical across requests and process restarts (FR-004, SC-002).
- Canonical key ordering means a JS object-literal reordering in the registry would NOT spuriously change the hash, while any real content change (add/remove/reorder field, relabel, toggle required, change options/validation) WILL — declared field order is part of the input, satisfying "reordering changes version" (FR-002).
- Per-country input only → one country's change cannot affect another's hash (FR-003, SC-003).
- `node:crypto` is stdlib; no new dependency. SHA-256 is fast and collision-resistant enough for cache-busting (security is not a goal — Assumptions).
- 16 hex chars (64 bits) is ample to avoid accidental collisions across a handful of countries while keeping the value compact for `ETag`/cache keys.

**Alternatives considered**:
- `JSON.stringify` without canonical ordering — rejected: brittle, key-order dependent, and field-order already encodes display order so we want intentional ordering, not accidental.
- Non-crypto hash (FNV/CRC32) — rejected: marginal speed gain, no stdlib one-liner, and crypto digest is already negligible cost at this scale.
- A manual integer `version` bumped by hand — rejected: violates "data not code", easy to forget, can't satisfy "changes iff content changes" automatically.
- Full digest (64 hex) — rejected: unnecessarily long for a cache token; truncation is fine for non-security use.

## R2. Where to expose `version`

**Decision**: Add `version: string` to the **fields** response only (`countryFieldsResponseSchema`), at the top level alongside `code`, `name`, `fields`. The country **list** response is unchanged.

**Rationale**: Version is per-country-layout. The list is a lightweight selector (code + name, FR-011) and adding per-country versions there would invite clients to cache full layouts from the list, which is not its job.

**Alternatives considered**: Putting version inside each field — rejected: the cache unit is the whole country layout, not individual fields. An HTTP `ETag` header instead of a body field — deferred: a body field is simpler to consume from the typed payload and is contract-visible in OpenAPI; an `ETag` could be layered on later from the same hash without breaking the contract.

## R3. Pattern safety: JSON-safety + catastrophic backtracking

**Decision**: Today no registry field uses `validation.pattern` (all constraints are `length`/`numeric`). Keep it that way for existing countries, and enforce the contract with a **registry-wide test** plus a **documented authoring rule** on `FieldValidation.pattern`:
- Each pattern MUST be a bare regex source (no `/.../ ` delimiters, no flags).
- Each pattern MUST compile via `new RegExp(source)`.
- Each pattern MUST be unchanged by `JSON.parse(JSON.stringify(source))` (FR-009).
- Each pattern MUST NOT contain nested unbounded quantifiers / known catastrophic-backtracking constructs (FR-010). The test applies a heuristic guard (e.g. reject `(...+)+`, `(...*)*`, `(.*)*`-style nesting) and an optional bounded-time match smoke check.

**Rationale**: The pattern is the only validation rule the client executes as code, so it is the only one needing portability + DoS-safety guarantees. A test over `listCountryEntries()` enforces the rule for current and future countries without per-country special-casing (Principle II/VI). Documenting the rule next to the field type guides future authors.

**Alternatives considered**:
- Pull in a full ReDoS analyzer dependency (e.g. a safe-regex library) — reasonable, but a lightweight heuristic guard + compile/round-trip check covers the present need without a new dependency; can upgrade later if patterns proliferate.
- Server-side regex execution timeout — out of scope; the server validator runs on trusted, bounded input shapes and rejects oversized free-text via `maxLength`.

## R4. Submit validator — confirm, don't change

**Decision**: Leave `buildAddressValidator` and `fieldSchema` as-is. It already (a) derives from the same registry, (b) uses `.strict()` to reject unknown keys, (c) enforces length/numeric/pattern/dropdown/required. Add/confirm tests asserting unknown-key rejection and per-rule violation rejection (FR-013, FR-014, SC-005).

**Rationale**: The authoritative gate is already correct; the feature's job is to harden the *served* contract around it, not to alter enforcement. Touching it risks regressing the core safety property.

**Alternatives considered**: Refactor `fieldSchema` to share a single derivation with the metadata projection — nice-to-have, but the metadata projection and the Zod derivation already read the same `CountryFieldDef`; a shared intermediate is not required to meet FR-012 and would expand scope.

## R5. Performance / memoization

**Decision**: Compute `version` on each `getCountryFields` call. Optionally memoize per `CountryCode` since the registry is static at runtime.

**Rationale**: Hashing ~6 small field objects is microseconds; the endpoint is low-traffic metadata. Memoization is a trivial future optimization (registry is immutable in-process) and not required to meet any success criterion. Keep the first cut simple and pure.
