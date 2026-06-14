import { describe, it, expect } from "vitest";
import {
  createAddressRequestSchema,
  addressResponseSchema,
} from "./schemas.js";

describe("addresses schemas", () => {
  it("accepts a well-formed create request", () => {
    const parsed = createAddressRequestSchema.parse({
      country: "USA",
      fields: { line1: "1 Loop", city: "Cupertino", state: "CA", zip: "95014" },
    });
    expect(parsed.country).toBe("USA");
  });

  it("rejects missing country", () => {
    expect(() =>
      createAddressRequestSchema.parse({ fields: { a: "b" } }),
    ).toThrow();
  });

  it("rejects non-string field values", () => {
    expect(() =>
      createAddressRequestSchema.parse({ country: "USA", fields: { zip: 95014 } }),
    ).toThrow();
  });

  it("response schema validates an ISO createdAt + uuid id", () => {
    const ok = addressResponseSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      country: "USA",
      fields: { zip: "95014" },
      createdAt: new Date().toISOString(),
    });
    expect(ok.success).toBe(true);
  });
});
