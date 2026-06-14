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

export type CountrySummary = z.infer<typeof countrySummarySchema>;
export type FieldDefDto = z.infer<typeof fieldDefSchema>;
export type CountryFieldsResponse = z.infer<typeof countryFieldsResponseSchema>;
