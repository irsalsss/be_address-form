import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  countriesResponseSchema,
  countryFieldsResponseSchema,
  countryParamsSchema,
  writeCountryRequestSchema,
} from "./schemas.js";
import {
  listCountries,
  getCountryFields,
  createCountry,
  updateCountry,
} from "./service.js";

export async function countriesRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/v1/countries",
    {
      schema: {
        tags: ["countries"],
        response: { 200: countriesResponseSchema },
      },
    },
    async () => ({ countries: await listCountries() }),
  );

  typed.get(
    "/api/v1/countries/:code/fields",
    {
      schema: {
        tags: ["countries"],
        params: countryParamsSchema,
        response: { 200: countryFieldsResponseSchema },
      },
    },
    (req) => getCountryFields(req.params.code),
  );

  // NOTE: write path is intentionally unauthenticated for now (handoff Guard 2
  // deferred). Add an admin guard before exposing this beyond a trusted network.
  typed.post(
    "/api/v1/countries",
    {
      schema: {
        tags: ["countries"],
        body: writeCountryRequestSchema,
        response: { 201: countryFieldsResponseSchema },
      },
    },
    async (req, reply) => {
      const created = await createCountry(req.body);
      reply.code(201);
      return created;
    },
  );

  typed.put(
    "/api/v1/countries/:code",
    {
      schema: {
        tags: ["countries"],
        params: countryParamsSchema,
        body: writeCountryRequestSchema,
        response: { 200: countryFieldsResponseSchema },
      },
    },
    (req) => updateCountry(req.params.code, req.body),
  );
}
