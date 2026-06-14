import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { db } from "../../shared/db/client.js";
import { addresses } from "../../shared/db/schema.js";

describe("addresses routes", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await db.delete(addresses);
  });

  const post = (body: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/v1/addresses", payload: body });

  it("stores a valid USA address → 201 with id, read-back identical", async () => {
    const fields = { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014" };
    const res = await post({ country: "USA", fields });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.fields).toEqual(fields);

    const got = await app.inject({ method: "GET", url: `/api/v1/addresses/${body.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().fields).toEqual(fields);
  });

  it("AUS missing suburb → 400 problem+json", async () => {
    const res = await post({
      country: "AUS",
      fields: { line1: "x", state: "NSW", postcode: "2000" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json().code).toBe("BAD_REQUEST");
  });

  it("IDN 4-digit postal → 400", async () => {
    const res = await post({
      country: "IDN",
      fields: {
        province: "Bali", city: "Denpasar", district: "Denpasar Barat",
        postalCode: "8011", street: "Jl. X",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rule violation → 400 with human-readable details.fieldErrors keyed by field", async () => {
    const res = await post({
      country: "USA",
      fields: { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "12" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.details.fieldErrors.zip).toEqual([
      "ZIP Code must be exactly 5 digits",
    ]);
  });

  it("unknown extra field → 400 with the key in details.formErrors (banner)", async () => {
    const res = await post({
      country: "USA",
      fields: { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014", bogus: "x" },
    });
    expect(res.statusCode).toBe(400);
    const errs: string[] = res.json().details.formErrors;
    expect(errs.some((m) => m.includes("bogus"))).toBe(true);
  });

  it("unsupported country → 400", async () => {
    const res = await post({ country: "FR", fields: { line1: "x" } });
    expect(res.statusCode).toBe(400);
  });

  it("unknown extra field → 400 (.strict)", async () => {
    const res = await post({
      country: "USA",
      fields: { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014", bogus: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("missing body country → 400", async () => {
    const res = await post({ fields: { a: "b" } });
    expect(res.statusCode).toBe(400);
  });

  it("GET /addresses lists all saved", async () => {
    await post({ country: "USA", fields: { line1: "1 Loop", city: "C", state: "CA", zip: "95014" } });
    await post({ country: "AUS", fields: { line1: "1 St", suburb: "Sydney", state: "NSW", postcode: "2000" } });
    const res = await app.inject({ method: "GET", url: "/api/v1/addresses" });
    expect(res.statusCode).toBe(200);
    expect(res.json().addresses.length).toBe(2);
    expect(res.json().limit).toBe(50);
  });

  it("GET /addresses?limit=1 caps the page", async () => {
    await post({ country: "USA", fields: { line1: "1 Loop", city: "C", state: "CA", zip: "95014" } });
    await post({ country: "AUS", fields: { line1: "1 St", suburb: "Sydney", state: "NSW", postcode: "2000" } });
    const res = await app.inject({ method: "GET", url: "/api/v1/addresses?limit=1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().addresses.length).toBe(1);
    expect(res.json().limit).toBe(1);
  });

  it("GET nonexistent id → 404 (distinct from empty-list 200)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/addresses/00000000-0000-4000-8000-000000000000",
    });
    expect(res.statusCode).toBe(404);
    const list = await app.inject({ method: "GET", url: "/api/v1/addresses" });
    expect(list.statusCode).toBe(200);
    expect(list.json().addresses).toEqual([]);
  });

  it("malformed uuid param → 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/addresses/not-a-uuid" });
    expect(res.statusCode).toBe(400);
  });
});
