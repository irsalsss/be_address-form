import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createAddressRequestSchema,
  addressResponseSchema,
  addressesResponseSchema,
  addressParamsSchema,
} from "./schemas.js";
import {
  createAddress,
  getAllAddresses,
  getAddressById,
} from "./service.js";

export async function addressesRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/v1/addresses",
    {
      schema: {
        tags: ["addresses"],
        body: createAddressRequestSchema,
        response: { 201: addressResponseSchema },
      },
    },
    async (req, reply) => {
      const created = await createAddress(req.body);
      return reply.status(201).send(created);
    },
  );

  typed.get(
    "/api/v1/addresses",
    {
      schema: {
        tags: ["addresses"],
        response: { 200: addressesResponseSchema },
      },
    },
    async () => ({ addresses: await getAllAddresses() }),
  );

  typed.get(
    "/api/v1/addresses/:id",
    {
      schema: {
        tags: ["addresses"],
        params: addressParamsSchema,
        response: { 200: addressResponseSchema },
      },
    },
    async (req) => getAddressById(req.params.id),
  );
}
