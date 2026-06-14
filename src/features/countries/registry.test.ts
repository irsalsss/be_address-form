import { describe, it, expect } from "vitest";
import {
  listCountryEntries,
  normalizeCountryCode,
  isSupportedCountry,
  getCountry,
  hashCountryFields,
  type CountryFieldDef,
} from "./registry.js";

describe("country registry", () => {
  it("exposes exactly the three launch countries", () => {
    const codes = listCountryEntries().map((c) => c.code).sort();
    expect(codes).toEqual(["AUS", "IDN", "USA"]);
  });

  it("every dropdown field has a non-empty options set", () => {
    for (const country of listCountryEntries()) {
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
    for (const country of listCountryEntries()) {
      const keys = country.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("matches the required-field layout per spec", () => {
    const required = (code: "USA" | "AUS" | "IDN") =>
      getCountry(code).fields.filter((f) => f.required).map((f) => f.key).sort();
    expect(required("USA")).toEqual(["city", "line1", "state", "zip"]);
    expect(required("AUS")).toEqual(["line1", "postcode", "state", "suburb"]);
    expect(required("IDN")).toEqual(
      ["city", "district", "postalCode", "province", "street"].sort(),
    );
  });

  it("AUS state dropdown is exactly the 8 states/territories", () => {
    const state = getCountry("AUS").fields.find((f) => f.key === "state");
    expect(state!.options!.map((o) => o.value)).toEqual([
      "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT",
    ]);
  });

  it("normalizes casing and rejects unknown codes", () => {
    expect(normalizeCountryCode("us")).toBe("USA");
    expect(normalizeCountryCode("  idn ")).toBe("IDN");
    expect(normalizeCountryCode("XX")).toBeNull();
    expect(isSupportedCountry("aus")).toBe(true);
    expect(isSupportedCountry("fr")).toBe(false);
  });
});

describe("hashCountryFields — content-derived version (FR-001..004)", () => {
  const usa = () => getCountry("USA").fields;

  it("is deterministic and sha256-prefixed", () => {
    const a = hashCountryFields(usa());
    const b = hashCountryFields(usa());
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("changes when any field definition changes", () => {
    const base = hashCountryFields(usa());
    const clone = (): CountryFieldDef[] =>
      usa().map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }));

    // relabel
    const relabel = clone();
    relabel[0] = { ...relabel[0]!, label: "Street" };
    expect(hashCountryFields(relabel)).not.toBe(base);

    // required toggle
    const reqToggle = clone();
    reqToggle[1] = { ...reqToggle[1]!, required: !reqToggle[1]!.required };
    expect(hashCountryFields(reqToggle)).not.toBe(base);

    // reorder
    const reordered = clone();
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    expect(hashCountryFields(reordered)).not.toBe(base);

    // add field
    const added = clone();
    added.push({ key: "extra", label: "Extra", required: false, type: "text" });
    expect(hashCountryFields(added)).not.toBe(base);

    // remove field
    const removed = clone().slice(0, -1);
    expect(hashCountryFields(removed)).not.toBe(base);

    // validation change
    const valChange = clone();
    const zipIdx = valChange.findIndex((f) => f.key === "zip");
    valChange[zipIdx] = {
      ...valChange[zipIdx]!,
      validation: { length: 9, numeric: true },
    };
    expect(hashCountryFields(valChange)).not.toBe(base);

    // option-set change
    const optChange = clone();
    const stateIdx = optChange.findIndex((f) => f.key === "state");
    optChange[stateIdx] = {
      ...optChange[stateIdx]!,
      options: [{ value: "CA", label: "CA" }],
    };
    expect(hashCountryFields(optChange)).not.toBe(base);
  });

  it("is independent per country", () => {
    const codes = ["USA", "AUS", "IDN"] as const;
    const hashes = codes.map((c) => hashCountryFields(getCountry(c).fields));
    expect(new Set(hashes).size).toBe(codes.length);
  });
});

describe("validation.pattern safety (FR-008/009/010, SC-004)", () => {
  // A simple check for nested open-ended repeats — the common slow
  // backtracking shape, e.g. (x+)+, (x*)*, (.*)* .
  const CATASTROPHIC = /\(([^()]*[*+])[^()]*\)\s*[*+]/;

  const patterns = listCountryEntries().flatMap((c) =>
    c.fields
      .filter((f) => f.validation?.pattern !== undefined)
      .map((f) => ({ where: `${c.code}.${f.key}`, src: f.validation!.pattern! })),
  );

  it("every exposed pattern compiles, round-trips JSON, and is backtracking-safe", () => {
    for (const { where, src } of patterns) {
      expect(() => new RegExp(src), where).not.toThrow();
      expect(JSON.parse(JSON.stringify(src)), where).toBe(src);
      expect(CATASTROPHIC.test(src), `${where} catastrophic`).toBe(false);
    }
  });

  it("guard rejects a known catastrophic pattern", () => {
    // self-check, so an empty pattern list above can't hide a broken guard
    expect(CATASTROPHIC.test("(a+)+")).toBe(true);
    expect(CATASTROPHIC.test("^\\d{5}$")).toBe(false);
  });
});
