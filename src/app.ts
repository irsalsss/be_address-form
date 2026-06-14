import Fastify, { type FastifyInstance } from "fastify";
import {
  validatorCompiler,
  serializerCompiler,
} from "fastify-type-provider-zod";
import { logger } from "./shared/logger.js";
import { registerCors } from "./plugins/cors.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { healthRoutes } from "./features/health/index.js";
import { countriesRoutes } from "./features/countries/index.js";
import { addressesRoutes } from "./features/addresses/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  // pino v10 + Fastify 5 type incompatibility: loggerInstance propagates pino
  // v10's Logger type through the instance, which FastifyBaseLogger doesn't match.
  // Cast away until Fastify catches up with pino v10 BaseLogger changes.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const app = Fastify({
    loggerInstance: logger as any,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: "x-request-id",
    disableRequestLogging: false,
  }) as any as FastifyInstance;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Zod type provider: validate + serialize via Zod schemas
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerCors(app);
  registerErrorHandler(app);
  await registerSwagger(app);

  // Feature routes — health is untyped; typed routes use ZodTypeProvider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (app as any).register(healthRoutes);
  await app.register(countriesRoutes);
  await app.register(addressesRoutes);

  return app;
}
