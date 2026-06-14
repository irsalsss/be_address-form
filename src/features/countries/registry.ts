// Country registry — SINGLE SOURCE OF TRUTH for field layouts + validation.
// Both the metadata API and the submit-time Zod validator derive from these
// definitions, so client and server rules cannot diverge (FR-014).
// Adding a country = adding one entry here; no flow logic changes (FR-016).

export type CountryCode = "USA" | "AUS" | "IDN";

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
  /** explicit regex source, overrides length/numeric when present */
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

const REGISTRY: Record<CountryCode, Country> = {
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

// ISO alpha-2 → canonical alpha-3 aliases, so `us`/`au`/`id` resolve too.
const ALIASES: Record<string, CountryCode> = { US: "USA", AU: "AUS", ID: "IDN" };

/** Normalize an arbitrary country input to a canonical code, or null. */
export function normalizeCountryCode(input: string): CountryCode | null {
  const code = input.trim().toUpperCase();
  if (code in REGISTRY) return code as CountryCode;
  return ALIASES[code] ?? null;
}

export function isSupportedCountry(input: string): boolean {
  return normalizeCountryCode(input) !== null;
}

export function getCountry(code: CountryCode): Country {
  return REGISTRY[code];
}

export function listCountryEntries(): Country[] {
  return Object.values(REGISTRY);
}
