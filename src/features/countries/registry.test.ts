import { describe, it, expect } from "vitest";
import {
  SEED_COUNTRIES,
  seedCountryEntries,
  canonicalizeCode,
  hashCountryFields,
  isSafePattern,
  MAX_PATTERN_LENGTH,
  type CountryFieldDef,
} from "./registry.js";

describe("country seed data", () => {
  it("exposes exactly the three launch countries", () => {
    const codes = seedCountryEntries()
      .map((c) => c.code)
      .sort();
    expect(codes).toEqual(["AUS", "IDN", "USA"]);
  });

  it("every dropdown field has a non-empty options set", () => {
    for (const country of seedCountryEntries()) {
      for (const field of country.fields) {
        if (field.type === "dropdown") {
          expect(field.options, `${country.code}.${field.key}`).toBeDefined();
          expect(field.options!.length).toBeGreaterThan(0);
        } else {
          expect(field.options).toBeUndefined();
        }
      }
    }
  });

  it("field keys are unique within each country", () => {
    for (const country of seedCountryEntries()) {
      const keys = country.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("matches the required-field layout per spec", () => {
    const required = (code: "USA" | "AUS" | "IDN") =>
      SEED_COUNTRIES[code]!.fields.filter((f) => f.required).map((f) => f.key).sort();
    expect(required("USA")).toEqual(["city", "line1", "state", "zip"]);
    expect(required("AUS")).toEqual(["line1", "postcode", "state", "suburb"]);
    expect(required("IDN")).toEqual(
      ["city", "district", "postalCode", "province", "street"].sort(),
    );
  });

  it("AUS state dropdown is exactly the 8 states/territories", () => {
    const state = SEED_COUNTRIES.AUS!.fields.find((f) => f.key === "state");
    expect(state!.options!.map((o) => o.value)).toEqual([
      "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT",
    ]);
  });
});

describe("canonicalizeCode — pure normalization (no existence check)", () => {
  it("uppercases, trims, and resolves 2-letter aliases", () => {
    expect(canonicalizeCode("us")).toBe("USA");
    expect(canonicalizeCode("  id ")).toBe("IDN");
    expect(canonicalizeCode("au")).toBe("AUS");
  });

  it("passes through unknown but well-formed codes (existence is the DB's job)", () => {
    expect(canonicalizeCode("FRA")).toBe("FRA");
    expect(canonicalizeCode("xx")).toBe("XX");
  });

  it("rejects blank or wrong-length input", () => {
    expect(canonicalizeCode("")).toBeNull();
    expect(canonicalizeCode("U")).toBeNull();
    expect(canonicalizeCode("USAA")).toBeNull();
  });
});

describe("hashCountryFields — content-derived version (FR-001..004)", () => {
  const usa = () => SEED_COUNTRIES.USA!.fields;

  it("is stable across calls for the same content", () => {
    const a = hashCountryFields(usa());
    const b = hashCountryFields(usa());
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("changes when a label, requiredness, order, field set, validation, or option changes", () => {
    const base = hashCountryFields(usa());

    const relabel = structuredClone(usa());
    relabel[0]!.label = "Different";
    expect(hashCountryFields(relabel)).not.toBe(base);

    const reqToggle = structuredClone(usa());
    reqToggle[0]!.required = !reqToggle[0]!.required;
    expect(hashCountryFields(reqToggle)).not.toBe(base);

    const reordered = [...usa()].reverse();
    expect(hashCountryFields(reordered)).not.toBe(base);

    const added = [...usa(), { key: "x", label: "X", required: false, type: "text" } as CountryFieldDef];
    expect(hashCountryFields(added)).not.toBe(base);

    const removed = usa().slice(0, -1);
    expect(hashCountryFields(removed)).not.toBe(base);

    const valChange = structuredClone(usa());
    const zip = valChange.find((f) => f.key === "zip")!;
    zip.validation = { length: 6, numeric: true };
    expect(hashCountryFields(valChange)).not.toBe(base);

    const optChange = structuredClone(SEED_COUNTRIES.USA!.fields);
    const st = optChange.find((f) => f.key === "state")!;
    st.options = [{ value: "CA", label: "CA" }];
    expect(hashCountryFields(optChange)).not.toBe(base);
  });

  it("differs per country", () => {
    const hashes = seedCountryEntries().map((c) => hashCountryFields(c.fields));
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe("isSafePattern — ReDoS guard (Guard 1, FR-008/009/010)", () => {
  it("accepts every pattern in the seed data", () => {
    for (const country of seedCountryEntries()) {
      for (const f of country.fields) {
        const p = f.validation?.pattern;
        if (p !== undefined) {
          expect(isSafePattern(p), `${country.code}.${f.key}`).toBe(true);
        }
      }
    }
  });

  it("rejects nested open-ended repeats (catastrophic backtracking)", () => {
    expect(isSafePattern("(a+)+")).toBe(false);
    expect(isSafePattern("(.*)*")).toBe(false);
    expect(isSafePattern("(x*)*$")).toBe(false);
  });

  it("rejects oversized and uncompilable patterns", () => {
    expect(isSafePattern("a".repeat(MAX_PATTERN_LENGTH + 1))).toBe(false);
    expect(isSafePattern("(")).toBe(false);
  });

  it("accepts simple anchored patterns", () => {
    expect(isSafePattern("^\\d{5}$")).toBe(true);
    expect(isSafePattern("^[A-Z]{2}$")).toBe(true);
  });
});
