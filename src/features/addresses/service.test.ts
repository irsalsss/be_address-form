import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../shared/db/client.js";
import { addresses } from "../../shared/db/schema.js";
import {
  createAddress,
  getAllAddresses,
  getAddressById,
} from "./service.js";
import { BadRequestError, NotFoundError } from "../../shared/errors.js";

describe("addresses service", () => {
  beforeEach(async () => {
    await db.delete(addresses);
  });

  const usa = {
    country: "USA",
    fields: { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014" },
  };

  it("persists a valid address and maps the response", async () => {
    const res = await createAddress(usa);
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.country).toBe("USA");
    expect(res.fields).toEqual(usa.fields);
    expect(typeof res.createdAt).toBe("string");
  });

  it("normalizes country code on store (us → USA)", async () => {
    const res = await createAddress({ ...usa, country: "us" });
    expect(res.country).toBe("USA");
  });

  it("throws BadRequestError on unsupported country", async () => {
    await expect(createAddress({ ...usa, country: "XX" })).rejects.toThrow(
      BadRequestError,
    );
  });

  it("throws on invalid fields (bad zip)", async () => {
    await expect(
      createAddress({ ...usa, fields: { ...usa.fields, zip: "1" } }),
    ).rejects.toThrow();
  });

  it("lists all stored addresses", async () => {
    await createAddress(usa);
    await createAddress({
      country: "AUS",
      fields: { line1: "1 Macquarie St", suburb: "Sydney", state: "NSW", postcode: "2000" },
    });
    const all = await getAllAddresses();
    expect(all.addresses.length).toBe(2);
    expect(all.limit).toBe(50);
    expect(all.offset).toBe(0);
  });

  it("getAddressById returns the record, or NotFound", async () => {
    const created = await createAddress(usa);
    expect((await getAddressById(created.id)).id).toBe(created.id);
    await expect(
      getAddressById("00000000-0000-4000-8000-000000000000"),
    ).rejects.toThrow(NotFoundError);
  });
});
