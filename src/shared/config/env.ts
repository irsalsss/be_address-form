import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(0).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGINS: z.string().default(""),
  DATABASE_URL: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
