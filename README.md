# Acme Address API

Backend service for AcmeCorp's customer onboarding address management.

## Stack

Fastify 5 + TypeScript + Drizzle ORM + PostgreSQL 17

## Quick start

```bash
cp .env.example .env    # then edit DATABASE_URL
pnpm install
docker compose up -d db  # start Postgres
pnpm db:migrate          # apply migrations
pnpm dev                 # http://localhost:4000
```

## Local Postgres on port 5432

If you already run a Postgres on your host's `localhost:5432`, it shadows the
docker container (loopback wins over the container's `*` bind), and migrations /
tests connect to the wrong database (`role "app" does not exist`).

Two fixes:

- **Simplest**: stop the host Postgres while running the DB suite
  (`brew services stop postgresql@NN`), then restart it after.
- **Run both side by side** (no committed changes): create a local
  `docker-compose.override.yml` (gitignored) mapping the container to host port
  `5433`, and point `.env` at it:

  ```yaml
  # docker-compose.override.yml
  services:
    db:
      ports: ["5433:5432"]
  ```

  ```bash
  # .env
  DATABASE_URL=postgres://app:app@localhost:5433/app
  ```

  `docker compose up -d db` auto-merges the override; `pnpm db:migrate` and the
  app both read `.env`, so everything targets `5433`. Teammates/CI are
  unaffected (the override is local-only).

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/docs` | Swagger UI (dev only) |
| GET | `/api/v1/countries` | Supported countries (`code`, `name`, `version`) for the selector — `version` lets a client build its per-country cache key from the list alone |
| GET | `/api/v1/countries/:code/fields` | Field metadata for a country: per-field `label`, `required`, `type`, `options`, `validation`, `order`, plus the same content-derived `version` for client caching |
| POST | `/api/v1/addresses` | Create an address (validated against the country's registry-derived strict schema) |
| GET | `/api/v1/addresses` | List stored addresses (offset pagination) |
| GET | `/api/v1/addresses/:id` | Fetch one address |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for the full architecture contract.

## Design Decisions & Trade-offs (take-home notes)

I built this against the "country-aware address capture" brief. Here's the thinking behind the choices that actually matter, and the things I knowingly left on the table to stay inside the timebox. I've tried to be honest about both, because the trade-offs say more about how I work than the happy path does.

### Design decisions

1. **One country registry, treated as the single source of truth.**
   Metadata endpoints and submit-time validator both derive from it, so they can't drift.

2. **Validation is derived from metadata, not hand-written per country.**
   `buildAddressValidator()` compiles a strict Zod schema from the registry per request.

3. **A `jsonb` column for the address body instead of a wide table.**
   Three countries don't share a shape, so jsonb avoids NULL-heavy columns and migrations.

4. **Strict layering: routes call services, services call the repository.**
   ESLint-enforced; only the repository touches the DB, keeping logic unit-testable.

5. **Boring, production-shaped defaults, on purpose.**
   problem+json, redacted pino, boot-time env validation, generated OpenAPI, graceful shutdown.

6. **Forgiving on input, strict on storage.**
   Mixed casing and ISO alpha-2 codes resolve to one canonical code.

7. **A content-derived `version` token drives client caching.**
   Each country's field layout is hashed (`sha256:` prefix). Same value across requests/restarts, changes only when the definitions do. Exposed on both the list and fields endpoints so a client can cache and refresh per country without a round-trip. It's a cache tag, not a security token.

8. **Validation errors are human-readable and field-labelled.**
   Messages like `Postcode must be exactly 4 digits` are surfaced verbatim next to the offending input. Optional fields treat a blank/whitespace value as "not provided", and registry `pattern` rules are kept ReDoS-safe (no nested open-ended repeats), checked by a registry test.

### Trade-offs

| Decision | The trade-off | Why it's fine for this scope, and what I'd do at scale |
|---|---|---|
| `jsonb` for the address fields | No DB-level constraints or cheap indexing on individual fields | App-boundary validation blocks bad data; promote hot fields when querying matters. |
| Registry lives in code, not a DB table | Adding a country is a deploy | Shaped as data, so lifting into a table later is mechanical. |
| Rules as `length` / `numeric` / `pattern` | Not a full international address grammar | Covers the brief; `pattern` handles anything fancier without schema changes. |
| Google Places autocomplete is frontend-only | Backend never sees or validates the Places payload | Matches the brief; backend validates the country field set regardless. |
| No auth, rate limiting, or multi-tenancy | The endpoints are open | Out of scope; plugin structure leaves clean seams to add later. |
| Order by `created_at` with offset pagination | Offset pagination slows on large tables | Fine for a demo; cursor pagination is a contained repository change. |

### If I'd had more than the timebox

I'd add cursor-based pagination, a small integration test against a throwaway Postgres (testcontainers) that runs the full POST then GET round-trip for each country, and I'd promote `country_code` plus a couple of hot fields out of `jsonb` once real query patterns made the case for it.
