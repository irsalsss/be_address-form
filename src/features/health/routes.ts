import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export async function healthRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
  }));
}
