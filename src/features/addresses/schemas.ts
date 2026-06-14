import { z } from "zod";

// Top-level submission shape. Per-country field rules are enforced separately by
// the registry-derived validator (countries/service buildAddressValidator), so
// here `fields` is only checked to be a string→string map. The strict, country
// -specific parse happens in the service and throws ZodError on violation.
export const createAddressRequestSchema = z.object({
  country: z.string().min(1),
  fields: z.record(z.string(), z.string()),
});

export const addressResponseSchema = z.object({
  id: z.string().uuid(),
  country: z.string(),
  fields: z.record(z.string(), z.string()),
  createdAt: z.string(),
});

export const addressesResponseSchema = z.object({
  addresses: z.array(addressResponseSchema),
});

export const addressParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateAddressRequest = z.infer<typeof createAddressRequestSchema>;
export type AddressResponse = z.infer<typeof addressResponseSchema>;
