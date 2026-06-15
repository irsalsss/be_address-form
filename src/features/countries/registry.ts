// Country registry — types, the canonical SEED data, and the pure helpers
// (code canonicalization, content hash, regex-safety guard) shared by the
// DB-backed service and the seed script.
//
// Countries are now stored in the `countries` table (see shared/db/schema.ts),
// authored at runtime via the write API. SEED_COUNTRIES below is loaded once by
// src/shared/db/seed.ts. To change a built-in country's defaults, edit it here
// and re-run the seed; to add a country at runtime, POST /api/v1/countries.
//
// The metadata API and the submit-time Zod validator both read the same stored
// rows, so client and server rules stay identical (FR-014).

import { createHash } from "node:crypto";

// Country codes are runtime data now (a country can be added via the API), so
// this is a plain string rather than a closed union. The SEED entries below
// still use canonical ISO-alpha-3 codes.
export type CountryCode = string;

export type FieldType = "text" | "dropdown";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  /** exact character length (e.g. ZIP = 5) */
  length?: number;
  /** digits-only */
  numeric?: boolean;
  /**
   * A regex pattern. When set, it is used instead of length/numeric.
   *
   * RULES FOR WRITING IT (sent to clients and built there — FR-008/009/010):
   * - Write only the pattern text. Do not add `/.../` or flags.
   * - It must work with `new RegExp(source)` and stay the same after going
   *   through JSON (it is sent inside the metadata payload).
   * - Do not use patterns that can be very slow, such as nested open-ended
   *   repeats like `(x+)+`, `(x*)*`, or `(.*)*`. Keep them simple. Use
   *   anchors and fixed limits where you can.
   * A test in registry.test.ts checks these rules for the whole registry.
   */
  pattern?: string;
  /** max length for free-text fields (default 200) */
  maxLength?: number;
}

export interface CountryFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  options?: FieldOption[];
  validation?: FieldValidation;
}

export interface Country {
  code: CountryCode;
  name: string;
  fields: CountryFieldDef[];
}

const opt = (values: string[]): FieldOption[] =>
  values.map((v) => ({ value: v, label: v }));

const US_STATES = opt([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const AUS_STATES = opt(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]);

const IDN_PROVINCES = opt([
  "Aceh", "Sumatra Utara", "Sumatra Barat", "Riau", "Jambi", "Sumatra Selatan",
  "Bengkulu", "Lampung", "Kepulauan Bangka Belitung", "Kepulauan Riau",
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur",
  "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan",
  "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Sulawesi Tengah",
  "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat",
  "Maluku", "Maluku Utara", "Papua", "Papua Barat",
]);

// Canonical built-in countries. Loaded into the `countries` table by the seed
// script (idempotent). This is seed data, not the live source of truth — the
// service reads from the DB.
export const SEED_COUNTRIES: Record<string, Country> = {
  USA: {
    code: "USA",
    name: "United States",
    fields: [
      { key: "line1", label: "Address Line 1", required: true, type: "text" },
      { key: "line2", label: "Address Line 2", required: false, type: "text" },
      { key: "city", label: "City", required: true, type: "text" },
      { key: "state", label: "State", required: true, type: "dropdown", options: US_STATES },
      { key: "zip", label: "ZIP Code", required: true, type: "text", validation: { length: 5, numeric: true } },
    ],
  },
  AUS: {
    code: "AUS",
    name: "Australia",
    fields: [
      { key: "line1", label: "Address Line 1", required: true, type: "text" },
      { key: "line2", label: "Address Line 2", required: false, type: "text" },
      { key: "suburb", label: "Suburb", required: true, type: "text" },
      { key: "state", label: "State", required: true, type: "dropdown", options: AUS_STATES },
      { key: "postcode", label: "Postcode", required: true, type: "text", validation: { length: 4, numeric: true } },
    ],
  },
  IDN: {
    code: "IDN",
    name: "Indonesia",
    fields: [
      { key: "province", label: "Province", required: true, type: "dropdown", options: IDN_PROVINCES },
      { key: "city", label: "City / Regency", required: true, type: "text" },
      { key: "district", label: "District (Kecamatan)", required: true, type: "text" },
      { key: "village", label: "Village (Kelurahan/Desa)", required: false, type: "text" },
      { key: "postalCode", label: "Postal Code", required: true, type: "text", validation: { length: 5, numeric: true } },
      { key: "street", label: "Street Address", required: true, type: "text" },
    ],
  },
};

// Short 2-letter codes mapped to the main 3-letter codes, so `us`/`au`/`id` work too.
const ALIASES: Record<string, CountryCode> = { US: "USA", AU: "AUS", ID: "IDN" };

/**
 * Normalize a country code to its canonical stored form: trim, uppercase, and
 * resolve known 2-letter aliases (`us` → `USA`). This is a pure string
 * transform — it does NOT guarantee the country exists. Existence is a DB
 * lookup in the service. Returns null only for blank/oversized input.
 */
export function canonicalizeCode(input: string): CountryCode | null {
  const code = input.trim().toUpperCase();
  if (code.length < 2 || code.length > 3) return null;
  return ALIASES[code] ?? code;
}

/** All seed countries as a list (for the seed script and seed-integrity tests). */
export function seedCountryEntries(): Country[] {
  return Object.values(SEED_COUNTRIES);
}

// --- Regex-safety guard (Guard 1: ReDoS) -----------------------------------

/** Max characters allowed in a user-authored validation `pattern`. */
export const MAX_PATTERN_LENGTH = 200;

// Detects nested open-ended repeats — the common catastrophic-backtracking
// shape, e.g. (x+)+, (x*)*, (.*)* . Same rule the registry has always enforced;
// now applied at write-time to API-authored patterns, not just at build-time.
const CATASTROPHIC = /\(([^()]*[*+])[^()]*\)\s*[*+]/;

/** True if a regex source is short, compilable, and not obviously catastrophic. */
export function isSafePattern(source: string): boolean {
  if (source.length > MAX_PATTERN_LENGTH) return false;
  if (CATASTROPHIC.test(source)) return false;
  try {
    new RegExp(source);
  } catch {
    return false;
  }
  return true;
}

// --- Hash of the field definitions (used as a cache version — FR-001..004) ---

/**
 * Builds a fixed-shape JSON for a field def. Keys are always written in the
 * same order, so changing the order in the source code does NOT change the
 * hash, but any real change to the content does. Optional values that are not
 * set are left out (not written as null).
 */
function canonicalField(f: CountryFieldDef): unknown {
  const out: Record<string, unknown> = {
    key: f.key,
    label: f.label,
    required: f.required,
    type: f.type,
  };
  if (f.options) out.options = f.options.map((o) => ({ value: o.value, label: o.label }));
  if (f.validation) {
    const v = f.validation;
    const cv: Record<string, unknown> = {};
    if (v.length !== undefined) cv.length = v.length;
    if (v.numeric !== undefined) cv.numeric = v.numeric;
    if (v.pattern !== undefined) cv.pattern = v.pattern;
    if (v.maxLength !== undefined) cv.maxLength = v.maxLength;
    out.validation = cv;
  }
  return out;
}

/**
 * Makes a hash from a country's field definitions. It depends only on the
 * content (including the field order), so it is the same across requests and
 * after the process restarts. It changes only when the definitions change, and
 * each country has its own value. Returns e.g. "sha256:1a2b3c4d5e6f7a8b". Used
 * to check the cache only, not for security (see Assumptions in spec).
 */
export function hashCountryFields(fields: CountryFieldDef[]): string {
  const canonical = JSON.stringify(fields.map(canonicalField));
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}
