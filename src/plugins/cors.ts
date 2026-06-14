import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "../shared/config/env.js";

export async function registerCors(app: FastifyInstance) {
  const origins = env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });
}
