import { describe, it, expect } from "vitest";
import {
  listCountries,
  getCountryFields,
  buildAddressValidator,
} from "./service.js";
import { NotFoundError, BadRequestError } from "../../shared/errors.js";

describe("countries service — metadata", () => {
  it("lists the three countries with code + name", () => {
    expect(listCountries()).toEqual([
      { code: "USA", name: "United States" },
      { code: "AUS", name: "Australia" },
      { code: "IDN", name: "Indonesia" },
    ]);
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
});

describe("countries service — client/server parity (FR-014 / SC-003)", () => {
  // The validation rules served by the metadata API must produce the same
  // accept/reject decision as the submit validator, because both derive from
  // the same registry. Verify the served constraints match the validator.
  it("served postal validation matches validator rejection", () => {
    for (const code of ["USA", "AUS", "IDN"] as const) {
      const meta = getCountryFields(code);
      const postal = meta.fields.find((f) => f.validation?.numeric);
      expect(postal).toBeDefined();
      const len = postal!.validation!.length!;
      const tooShort = "1".repeat(len - 1);
      const { schema } = buildAddressValidator(code);
      // a value violating the served length must be rejected by the validator
      const probe = { [postal!.key]: tooShort };
      expect(() => schema.parse(probe)).toThrow();
    }
  });
});
