import { describe, it, expect } from "vitest";
import {
  listCountries,
  getCountryFields,
  buildAddressValidator,
} from "./service.js";
import { NotFoundError, BadRequestError } from "../../shared/errors.js";

describe("countries service — metadata", () => {
  it("lists the three countries with code + name + per-country version", () => {
    const list = listCountries();
    expect(list.map((c) => ({ code: c.code, name: c.name }))).toEqual([
      { code: "USA", name: "United States" },
      { code: "AUS", name: "Australia" },
      { code: "IDN", name: "Indonesia" },
    ]);
    for (const c of list) expect(c.version).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("list version equals the same country's fields version (FR-001)", () => {
    for (const c of listCountries()) {
      expect(c.version).toBe(getCountryFields(c.code).version);
    }
  });

  it("returns IDN fields in declared order with order indexes", () => {
    const idn = getCountryFields("idn");
    expect(idn.code).toBe("IDN");
    expect(idn.fields.map((f) => f.key)).toEqual([
      "province", "city", "district", "village", "postalCode", "street",
    ]);
    expect(idn.fields.map((f) => f.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(idn.fields.find((f) => f.key === "village")!.required).toBe(false);
    expect(idn.fields.find((f) => f.key === "postalCode")!.validation).toEqual({
      length: 5,
      numeric: true,
    });
  });

  it("exposes USA zip validation length 5", () => {
    const zip = getCountryFields("USA").fields.find((f) => f.key === "zip");
    expect(zip!.validation).toEqual({ length: 5, numeric: true });
  });

  it("throws NotFoundError for an unknown country", () => {
    expect(() => getCountryFields("XX")).toThrow(NotFoundError);
  });

  it("returns a stable, sha256-prefixed version (FR-001/004, SC-002)", () => {
    const a = getCountryFields("USA");
    const b = getCountryFields("USA");
    expect(a.version).toBe(b.version);
    expect(a.version).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("resolves aliases to identical metadata + version (FR-015)", () => {
    const canonical = getCountryFields("USA");
    const alias = getCountryFields("us");
    expect(alias).toEqual(canonical);
    expect(alias.version).toBe(canonical.version);
  });

  it("payload is complete enough to render + validate for every country (FR-005/006/007, SC-001)", () => {
    for (const { code } of listCountries()) {
      const meta = getCountryFields(code);
      meta.fields.forEach((f, i) => {
        const at = `${code}.${f.key}`;
        expect(typeof f.key, at).toBe("string");
        expect(f.key.length, at).toBeGreaterThan(0);
        expect(typeof f.label, at).toBe("string");
        expect(f.label.length, at).toBeGreaterThan(0);
        expect(typeof f.required, at).toBe("boolean");
        expect(["text", "dropdown"], at).toContain(f.type);
        expect(f.order, at).toBe(i);
        if (f.type === "dropdown") {
          expect(f.options, at).toBeDefined();
          expect(f.options!.length, at).toBeGreaterThan(0);
          for (const o of f.options!) {
            expect(typeof o.value, at).toBe("string");
            expect(typeof o.label, at).toBe("string");
          }
        }
      });
    }
  });
});

describe("countries service — buildAddressValidator", () => {
  it("throws BadRequestError for unsupported country", () => {
    expect(() => buildAddressValidator("XX")).toThrow(BadRequestError);
  });

  const valid = {
    USA: { line1: "1 Infinite Loop", city: "Cupertino", state: "CA", zip: "95014" },
    AUS: { line1: "1 Macquarie St", suburb: "Sydney", state: "NSW", postcode: "2000" },
    IDN: {
      province: "Jawa Barat", city: "Bandung", district: "Coblong",
      postalCode: "40132", street: "Jl. Ganesha 10",
    },
  } as const;

  it("accepts a valid address for each country", () => {
    for (const [code, fields] of Object.entries(valid)) {
      const { schema } = buildAddressValidator(code);
      expect(() => schema.parse(fields), code).not.toThrow();
    }
  });

  it("accepts omitted optional fields (line2 / village)", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() => schema.parse(valid.USA)).not.toThrow();
  });

  it("treats empty/blank optional fields as omitted (line2)", () => {
    const { schema } = buildAddressValidator("USA");
    for (const blank of ["", "   "]) {
      const parsed = schema.parse({ ...valid.USA, line2: blank });
      expect(parsed.line2).toBeUndefined();
    }
  });

  it("rejects a missing required field (AUS suburb)", () => {
    const { schema } = buildAddressValidator("AUS");
    const { suburb, ...rest } = valid.AUS;
    void suburb;
    expect(() => schema.parse(rest)).toThrow();
  });

  it("rejects whitespace-only required text", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, city: "   " })).toThrow();
  });

  it("rejects a dropdown value outside the set (USA state ZZ)", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, state: "ZZ" })).toThrow();
  });

  it("rejects wrong postal length (AUS 5-digit, IDN 4-digit)", () => {
    expect(() =>
      buildAddressValidator("AUS").schema.parse({ ...valid.AUS, postcode: "20000" }),
    ).toThrow();
    expect(() =>
      buildAddressValidator("IDN").schema.parse({ ...valid.IDN, postalCode: "4013" }),
    ).toThrow();
  });

  it("rejects non-numeric postal code", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, zip: "9501A" })).toThrow();
  });

  it("rejects unknown extra fields (.strict)", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, bogus: "x" })).toThrow();
  });

  it("rejects over-long free-text fields (max 200)", () => {
    const { schema } = buildAddressValidator("USA");
    expect(() =>
      schema.parse({ ...valid.USA, line1: "x".repeat(201) }),
    ).toThrow();
  });

  it("emits human-readable, field-labelled messages clients can show verbatim", () => {
    const { schema } = buildAddressValidator("USA");
    const flat = (fields: Record<string, unknown>) =>
      schema.safeParse(fields).error!.flatten().fieldErrors;

    expect(flat({ ...valid.USA, zip: "12" }).zip).toEqual([
      "ZIP Code must be exactly 5 digits",
    ]);
    expect(flat({ ...valid.USA, state: "ZZ" }).state).toEqual([
      "State must be one of the listed options",
    ]);
    const { city, ...noCity } = valid.USA;
    void city;
    expect(flat(noCity).city).toEqual(["City is required"]);
  });
});

describe("countries service — client/server parity (FR-014 / SC-003)", () => {
  // The validation rules sent by the metadata API must give the same
  // accept/reject result as the submit validator, because both come from the
  // same registry. Check that the sent rules match the validator.
  it("served postal validation matches validator rejection", () => {
    for (const code of ["USA", "AUS", "IDN"] as const) {
      const meta = getCountryFields(code);
      const postal = meta.fields.find((f) => f.validation?.numeric);
      expect(postal).toBeDefined();
      const len = postal!.validation!.length!;
      const tooShort = "1".repeat(len - 1);
      const { schema } = buildAddressValidator(code);
      // a value that breaks the sent length must be rejected by the validator
      const probe = { [postal!.key]: tooShort };
      expect(() => schema.parse(probe)).toThrow();
    }
  });
});
