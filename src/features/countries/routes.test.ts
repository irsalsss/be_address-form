import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";

describe("countries routes", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/countries returns the three countries", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/countries" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.countries.map((c: { code: string }) => c.code)).toEqual([
      "USA", "AUS", "IDN",
    ]);
  });

  it("GET /api/v1/countries/IDN/fields returns ordered layout", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/countries/IDN/fields",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe("IDN");
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
});
