import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "../shared/config/env.js";

export async function registerSwagger(app: FastifyInstance) {
  if (env.NODE_ENV === "production") return;

  await app.register(swagger, {
    openapi: {
      info: { title: "Acme Address API", version: "0.0.0" },
      servers: [{ url: `http://localhost:${env.PORT}` }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: "/docs" });
}
