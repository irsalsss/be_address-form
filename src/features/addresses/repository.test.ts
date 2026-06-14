import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../shared/db/client.js";
import { addresses } from "../../shared/db/schema.js";
import {
  insertAddress,
  listAddresses,
  findAddressById,
} from "./repository.js";

// Real Postgres — no mocks (Principle VI). Requires DATABASE_URL to a live DB.
describe("addresses repository", () => {
  beforeEach(async () => {
    await db.delete(addresses);
  });

  it("inserts and reads back fields with full fidelity (SC-001)", async () => {
    const fields = { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014" };
    const row = await insertAddress("USA", fields);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.countryCode).toBe("USA");
    expect(row.fields).toEqual(fields);
    expect(row.createdAt).toBeInstanceOf(Date);

    const found = await findAddressById(row.id);
    expect(found?.fields).toEqual(fields);
  });

  it("lists addresses newest-first", async () => {
    const a = await insertAddress("USA", { zip: "10001" });
    await new Promise((r) => setTimeout(r, 5)); // distinct created_at for ordering
    const b = await insertAddress("AUS", { postcode: "2000" });
    const rows = await listAddresses(50, 0);
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("honors limit + offset", async () => {
    for (let i = 0; i < 3; i++) {
      await insertAddress("USA", { zip: `1000${i}` });
      await new Promise((r) => setTimeout(r, 2));
    }
    const page1 = await listAddresses(2, 0);
    const page2 = await listAddresses(2, 2);
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(1);
    // no overlap across pages
    const ids = new Set([...page1, ...page2].map((r) => r.id));
    expect(ids.size).toBe(3);
  });

  it("findAddressById returns null when absent", async () => {
    const found = await findAddressById("00000000-0000-4000-8000-000000000000");
    expect(found).toBeNull();
  });
});
