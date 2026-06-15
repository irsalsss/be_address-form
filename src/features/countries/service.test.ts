import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../shared/db/client.js";
import { countries } from "../../shared/db/schema.js";
import {
  listCountries,
  getCountryFields,
  buildAddressValidator,
  createCountry,
  updateCountry,
} from "./service.js";
import type { WriteCountryRequest } from "./schemas.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../shared/errors.js";

// Throwaway code used by the write-path tests so they never mutate the seeded
// USA/AUS/IDN rows the read tests assert against. Cleaned up after each test.
const TMP = "ZZZ";
async function dropTmp() {
  await db.delete(countries).where(eq(countries.code, TMP));
}

describe("countries service — metadata (DB-backed)", () => {
  it("lists the three seeded countries with code + name + per-country version", async () => {
    const list = await listCountries();
    const byCode = Object.fromEntries(list.map((c) => [c.code, c.name]));
    expect(byCode).toMatchObject({
      USA: "United States",
      AUS: "Australia",
      IDN: "Indonesia",
    });
    for (const c of list) expect(c.version).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("list version equals the same country's fields version (FR-001)", async () => {
    for (const c of await listCountries()) {
      expect(c.version).toBe((await getCountryFields(c.code)).version);
    }
  });

  it("returns IDN fields in declared order with order indexes", async () => {
    const idn = await getCountryFields("idn");
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

  it("throws NotFoundError for an unknown country", async () => {
    await expect(getCountryFields("XX")).rejects.toThrow(NotFoundError);
  });

  it("returns a stable, sha256-prefixed version (FR-001/004, SC-002)", async () => {
    const a = await getCountryFields("USA");
    const b = await getCountryFields("USA");
    expect(a.version).toBe(b.version);
    expect(a.version).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("resolves aliases to identical metadata + version (FR-015)", async () => {
    const canonical = await getCountryFields("USA");
    const alias = await getCountryFields("us");
    expect(alias).toEqual(canonical);
  });
});

describe("countries service — buildAddressValidator (DB-backed)", () => {
  const valid = {
    USA: { line1: "1 Infinite Loop", city: "Cupertino", state: "CA", zip: "95014" },
    AUS: { line1: "1 Macquarie St", suburb: "Sydney", state: "NSW", postcode: "2000" },
    IDN: {
      province: "Jawa Barat", city: "Bandung", district: "Coblong",
      postalCode: "40132", street: "Jl. Ganesha 10",
    },
  } as const;

  it("throws BadRequestError for unsupported country", async () => {
    await expect(buildAddressValidator("XX")).rejects.toThrow(BadRequestError);
  });

  it("accepts a valid address for each country", async () => {
    for (const [code, fields] of Object.entries(valid)) {
      const { schema } = await buildAddressValidator(code);
      expect(() => schema.parse(fields), code).not.toThrow();
    }
  });

  it("treats empty/blank optional fields as omitted (line2)", async () => {
    const { schema } = await buildAddressValidator("USA");
    for (const blank of ["", "   "]) {
      const parsed = schema.parse({ ...valid.USA, line2: blank });
      expect(parsed.line2).toBeUndefined();
    }
  });

  it("rejects a missing required field (AUS suburb)", async () => {
    const { schema } = await buildAddressValidator("AUS");
    const { suburb, ...rest } = valid.AUS;
    void suburb;
    expect(() => schema.parse(rest)).toThrow();
  });

  it("rejects a dropdown value outside the set (USA state ZZ)", async () => {
    const { schema } = await buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, state: "ZZ" })).toThrow();
  });

  it("rejects wrong postal length and non-numeric postal", async () => {
    const aus = await buildAddressValidator("AUS");
    expect(() => aus.schema.parse({ ...valid.AUS, postcode: "20000" })).toThrow();
    const usa = await buildAddressValidator("USA");
    expect(() => usa.schema.parse({ ...valid.USA, zip: "9501A" })).toThrow();
  });

  it("rejects unknown extra fields (.strict)", async () => {
    const { schema } = await buildAddressValidator("USA");
    expect(() => schema.parse({ ...valid.USA, bogus: "x" })).toThrow();
  });

  it("emits human-readable, field-labelled messages clients can show verbatim", async () => {
    const { schema } = await buildAddressValidator("USA");
    const flat = (fields: Record<string, unknown>) =>
      schema.safeParse(fields).error!.flatten().fieldErrors;

    expect(flat({ ...valid.USA, zip: "12" }).zip).toEqual([
      "ZIP Code must be exactly 5 digits",
    ]);
    expect(flat({ ...valid.USA, state: "ZZ" }).state).toEqual([
      "State must be one of the listed options",
    ]);
  });
});

describe("countries service — write path (create / update)", () => {
  afterEach(dropTmp);

  const sample: WriteCountryRequest = {
    code: TMP,
    name: "Testland",
    fields: [
      { key: "line1", label: "Address Line 1", required: true, type: "text" },
      { key: "region", label: "Region", required: true, type: "dropdown", options: [
        { value: "N", label: "North" },
        { value: "S", label: "South" },
      ] },
      { key: "postcode", label: "Postcode", required: true, type: "text", validation: { length: 4, numeric: true } },
    ],
  };

  it("creates a country and makes it immediately readable + usable for submit", async () => {
    const created = await createCountry(sample);
    expect(created.code).toBe(TMP);
    expect(created.version).toMatch(/^sha256:[0-9a-f]{16}$/);

    const read = await getCountryFields(TMP);
    expect(read.fields.map((f) => f.key)).toEqual(["line1", "region", "postcode"]);

    const { schema } = await buildAddressValidator(TMP);
    expect(() => schema.parse({ line1: "1 St", region: "N", postcode: "4000" })).not.toThrow();
    expect(() => schema.parse({ line1: "1 St", region: "X", postcode: "4000" })).toThrow();
  });

  it("rejects a duplicate code with ConflictError", async () => {
    await createCountry(sample);
    await expect(createCountry(sample)).rejects.toThrow(ConflictError);
  });

  it("rejects a ReDoS-prone regex pattern (Guard 1) with BadRequestError", async () => {
    const evil: WriteCountryRequest = {
      ...sample,
      fields: [
        { key: "line1", label: "L1", required: true, type: "text", validation: { pattern: "(a+)+$" } },
      ],
    };
    await expect(createCountry(evil)).rejects.toThrow(BadRequestError);
    // and nothing was persisted
    await expect(getCountryFields(TMP)).rejects.toThrow(NotFoundError);
  });

  it("rejects a dropdown field with no options (BadRequestError)", async () => {
    const bad: WriteCountryRequest = {
      ...sample,
      fields: [{ key: "region", label: "Region", required: true, type: "dropdown", options: [] }],
    };
    await expect(createCountry(bad)).rejects.toThrow(BadRequestError);
  });

  it("update replaces fields and bumps the version; 404 when absent", async () => {
    await createCountry(sample);
    const before = await getCountryFields(TMP);

    const updated = await updateCountry(TMP, {
      ...sample,
      name: "Testland 2",
      fields: [{ key: "only", label: "Only", required: true, type: "text" }],
    });
    expect(updated.name).toBe("Testland 2");
    expect(updated.fields.map((f) => f.key)).toEqual(["only"]);
    expect(updated.version).not.toBe(before.version);

    await dropTmp();
    await expect(
      updateCountry(TMP, sample),
    ).rejects.toThrow(NotFoundError);
  });

  it("canonicalizes the code on create (lower-case alias-free code uppercased)", async () => {
    const created = await createCountry({ ...sample, code: "zzz" });
    expect(created.code).toBe("ZZZ");
  });
});
