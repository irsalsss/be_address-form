import { z } from "zod";

// Metadata response schemas — registered on the metadata routes so the OpenAPI
// spec is generated from these (Principle VII).

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const fieldValidationSchema = z.object({
  length: z.number().int().positive().optional(),
  numeric: z.boolean().optional(),
  pattern: z.string().optional(),
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
});

export const countriesResponseSchema = z.object({
  countries: z.array(countrySummarySchema),
});

export const countryFieldsResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  fields: z.array(fieldDefSchema),
});

export const countryParamsSchema = z.object({
  code: z.string(),
});

export type CountrySummary = z.infer<typeof countrySummarySchema>;
export type FieldDefDto = z.infer<typeof fieldDefSchema>;
export type CountryFieldsResponse = z.infer<typeof countryFieldsResponseSchema>;
