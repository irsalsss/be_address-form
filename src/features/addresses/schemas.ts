import { z } from "zod";

// Top-level submission shape. Per-country field rules are enforced separately by
// the registry-derived validator (countries/service buildAddressValidator), so
// here `fields` is only checked to be a string→string map. The strict, country
// -specific parse happens in the service and throws ZodError on violation.
export const createAddressRequestSchema = z.object({
  country: z.string().min(1),
  // Bound key count and value length here so an oversized/junk body is cheap to
  // reject; per-country field rules are enforced by the registry validator.
  fields: z
    .record(z.string().max(40), z.string().max(500))
    .refine((o) => Object.keys(o).length <= 24, "too many fields"),
});

export const listAddressesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const addressResponseSchema = z.object({
  id: z.string().uuid(),
  country: z.string(),
  fields: z.record(z.string(), z.string()),
  createdAt: z.string(),
});

export const addressesResponseSchema = z.object({
  addresses: z.array(addressResponseSchema),
  limit: z.number().int(),
  offset: z.number().int(),
});

export const addressParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateAddressRequest = z.infer<typeof createAddressRequestSchema>;
export type AddressResponse = z.infer<typeof addressResponseSchema>;
