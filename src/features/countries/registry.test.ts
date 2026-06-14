import { describe, it, expect } from "vitest";
import {
  listCountryEntries,
  normalizeCountryCode,
  isSupportedCountry,
  getCountry,
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
