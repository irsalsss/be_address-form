import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  countriesResponseSchema,
  countryFieldsResponseSchema,
  countryParamsSchema,
} from "./schemas.js";
import { listCountries, getCountryFields } from "./service.js";

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
    async () => ({ countries: listCountries() }),
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
    async (req) => getCountryFields(req.params.code),
  );
}
