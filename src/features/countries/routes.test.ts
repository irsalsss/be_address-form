import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../../app.js";
import { db } from "../../shared/db/client.js";
import { countries } from "../../shared/db/schema.js";

const TMP = "ZZZ";

describe("countries routes", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await db.delete(countries).where(eq(countries.code, TMP));
  });

  it("GET /api/v1/countries returns the seeded countries with versions", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/countries" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const codes = body.countries.map((c: { code: string }) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["USA", "AUS", "IDN"]));
    for (const c of body.countries as { version: string }[]) {
      expect(c.version).toMatch(/^sha256:[0-9a-f]{16}$/);
    }
  });

  it("GET /api/v1/countries/IDN/fields returns ordered layout", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/countries/IDN/fields",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe("IDN");
    expect(body.version).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(body.fields.map((f: { key: string }) => f.key)).toEqual([
      "province", "city", "district", "village", "postalCode", "street",
    ]);
  });

  it("normalizes lower-case country code in the path", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/countries/aus/fields",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toBe("AUS");
  });

  it("GET unknown country → 404 problem+json", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/countries/XX/fields",
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json().code).toBe("NOT_FOUND");
  });

  const body = {
    code: TMP,
    name: "Testland",
    fields: [
      { key: "line1", label: "Address Line 1", required: true, type: "text" },
      { key: "postcode", label: "Postcode", required: true, type: "text", validation: { length: 4, numeric: true } },
    ],
  };

  it("POST /api/v1/countries creates a country → 201, then readable", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/countries", payload: body });
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe(TMP);

    const read = await app.inject({ method: "GET", url: `/api/v1/countries/${TMP}/fields` });
    expect(read.statusCode).toBe(200);
    expect(read.json().fields.map((f: { key: string }) => f.key)).toEqual(["line1", "postcode"]);
  });

  it("POST duplicate → 409 problem+json", async () => {
    await app.inject({ method: "POST", url: "/api/v1/countries", payload: body });
    const dup = await app.inject({ method: "POST", url: "/api/v1/countries", payload: body });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().code).toBe("CONFLICT");
  });

  it("POST with a ReDoS pattern → 400 (Guard 1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/countries",
      payload: {
        code: TMP,
        name: "Evil",
        fields: [{ key: "x", label: "X", required: true, type: "text", validation: { pattern: "(a+)+$" } }],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST with an unknown extra body field → 400 (.strict)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/countries",
      payload: { ...body, surprise: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT updates an existing country, 404 when absent", async () => {
    await app.inject({ method: "POST", url: "/api/v1/countries", payload: body });
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/countries/${TMP}`,
      payload: { ...body, name: "Renamed" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().name).toBe("Renamed");

    const missing = await app.inject({
      method: "PUT",
      url: "/api/v1/countries/QQQ",
      payload: { ...body, code: "QQQ" },
    });
    expect(missing.statusCode).toBe(404);
  });
});
