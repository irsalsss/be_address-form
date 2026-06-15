import { z } from "zod";

// Schemas for the metadata responses. They are added to the metadata routes,
// so the OpenAPI spec is built from them (Principle VII).

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const fieldValidationSchema = z.object({
  length: z.number().int().positive().optional(),
  numeric: z.boolean().optional(),
  pattern: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const fieldDefSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
  type: z.enum(["text", "dropdown"]),
  options: z.array(fieldOptionSchema).optional(),
  validation: fieldValidationSchema.optional(),
  order: z.number().int().nonnegative(),
});

export const countrySummarySchema = z.object({
  code: z.string(),
  name: z.string(),
  // Same content-derived token as the fields endpoint's `version`. Exposed here
  // so a client can build its per-country cache key straight from the list,
  // without first fetching each country's fields (FR-001).
  version: z.string(),
});

export const countriesResponseSchema = z.object({
  countries: z.array(countrySummarySchema),
});

export const countryFieldsResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  // A cache token made from this country's field layout (FR-001). It changes
  // only when the field definitions change; clients cache and refresh on it.
  version: z.string(),
  fields: z.array(fieldDefSchema),
});

export const countryParamsSchema = z.object({
  code: z.string(),
});

// --- Write path (POST/PUT /api/v1/countries) ---
// Structural validation only. `order` is positional (array index), so it is not
// accepted from the client. Security rules that Zod can't express cleanly —
// ReDoS-safe patterns, dropdowns having options, unique keys — are enforced in
// the service (assertFieldsAreSafe). Bounds here cap obviously-abusive input.

export const writeFieldSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must be alphanumeric, starting with a letter"),
    label: z.string().trim().min(1).max(100),
    required: z.boolean(),
    type: z.enum(["text", "dropdown"]),
    options: z.array(fieldOptionSchema).max(500).optional(),
    validation: fieldValidationSchema.optional(),
  })
  .strict();

export const writeCountryRequestSchema = z
  .object({
    code: z.string().trim().min(2).max(3),
    name: z.string().trim().min(1).max(100),
    fields: z.array(writeFieldSchema).min(1).max(50),
  })
  .strict();

export type CountrySummary = z.infer<typeof countrySummarySchema>;
export type FieldDefDto = z.infer<typeof fieldDefSchema>;
export type CountryFieldsResponse = z.infer<typeof countryFieldsResponseSchema>;
export type WriteCountryRequest = z.infer<typeof writeCountryRequestSchema>;
