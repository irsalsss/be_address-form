import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError, BadRequestError, InternalError } from "../shared/errors.js";
import { toProblem } from "../shared/http/problem.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // Route-level schema validation (body/params/query) via fastify-type-provider-zod
    // surfaces as a wrapped Fastify error, not a raw ZodError.
    if (hasZodFastifySchemaValidationErrors(err)) {
      const wrapped = new BadRequestError("validation failed", err.validation);
      const problem = toProblem(wrapped, req.url);
      return reply.status(problem.status).type("application/problem+json").send(problem);
    }

    if (err instanceof ZodError) {
      const wrapped = new BadRequestError("validation failed", err.flatten());
      const problem = toProblem(wrapped, req.url);
      return reply.status(problem.status).type("application/problem+json").send(problem);
    }

    if (err instanceof AppError) {
      const problem = toProblem(err, req.url);
      return reply.status(problem.status).type("application/problem+json").send(problem);
    }

    req.log.error({ err }, "unhandled error");
    const problem = toProblem(new InternalError(), req.url);
    return reply.status(500).type("application/problem+json").send(problem);
  });
}
