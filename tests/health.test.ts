import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { buildApp } from "../src/app.js";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });
});
