process.env.NODE_ENV = "test";
process.env.PORT = "0";
// Real Postgres for repository tests (no DB mocks — constitution Principle VI).
// Honor an externally-provided DATABASE_URL (CI / local container); otherwise
// default to the docker-compose `db` service.
process.env.DATABASE_URL ??= "postgres://app:app@localhost:5432/app";
