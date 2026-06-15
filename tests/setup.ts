process.env.NODE_ENV = "test";
process.env.PORT = "0";
// Real Postgres for repository tests (no DB mocks — constitution Principle VI).
// vitest does not auto-load .env, so load it here (e.g. a 5433 host-port
// override) before falling back. Ignore if absent — CI provides DATABASE_URL
// in the ambient environment.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — rely on ambient env
}
// Honor an externally-provided DATABASE_URL (CI / .env / local container);
// otherwise default to the docker-compose `db` service.
process.env.DATABASE_URL ??= "postgres://app:app@localhost:5432/app";

// Countries now live in the DB, and createAddress reads them at submit time, so
// every test file needs the built-in countries present. Seed once per file
// (idempotent — ON CONFLICT DO NOTHING). Imported dynamically so env above is
// set before the db client / env loader is first evaluated.
import { beforeAll } from "vitest";
beforeAll(async () => {
  const { seedCountries } = await import("../src/features/countries/seed.js");
  await seedCountries();
});
