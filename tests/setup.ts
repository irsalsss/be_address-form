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
