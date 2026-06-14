import { defineConfig } from "drizzle-kit";

// drizzle-kit does not auto-load .env, so DATABASE_URL would otherwise be unset
// and the driver would fall back to localhost:5432. Load it here so db:generate
// / db:migrate / db:studio honor the same DATABASE_URL as the app (incl. a
// 5433 host-port override). Ignore if absent (CI provides env externally).
try {
  process.loadEnvFile(".env");
} catch {
  // .env not present — rely on the ambient environment
}

export default defineConfig({
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
