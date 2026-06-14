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
pnpm dev                 # http://localhost:3000
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/docs` | Swagger UI (dev only) |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for the full architecture contract.

## Design Decisions & Trade-offs (take-home notes)

I built this against the "country-aware address capture" brief. Here's the thinking behind the choices that actually matter, and the things I knowingly left on the table to stay inside the timebox. I've tried to be honest about both, because the trade-offs say more about how I work than the happy path does.

### Design decisions

1. **One country registry, treated as the single source of truth.**
   Everything country-specific (the field list, labels, ordering, dropdown options, validation rules) lives in one place: [src/features/countries/registry.ts](src/features/countries/registry.ts). The metadata endpoints (`GET /countries`, `GET /countries/:code/fields`) and the submit-time validator are *both* generated from it. So the registry that tells the frontend "USA needs a 5-digit numeric ZIP" is the exact same registry that rejects a 4-digit ZIP on POST. They can't drift, because there's only one of them. This is also my answer to the brief's bonus question about supporting dynamic country-specific metadata: adding a country is a single entry in that file, with no new routes, schemas, or flow logic to touch.

2. **Validation is derived from metadata, not hand-written per country.**
   `buildAddressValidator()` compiles a strict Zod schema straight from the registry at request time ([service.ts](src/features/countries/service.ts)). Required vs optional, numeric length, dropdown enums, free-text length caps... they all fall out of the field definitions instead of being typed out by hand and slowly going stale. `.strict()` rejects unknown keys, so nobody can quietly smuggle extra fields into storage.

3. **A `jsonb` column for the address body instead of a wide table.**
   The three countries genuinely don't share a shape (the US has a `zip`, Indonesia has `kecamatan` and `kelurahan`). A single wide table would be mostly NULLs and would need a migration every time a new country showed up. Keeping the validated submission in a `jsonb` `fields` column ([schema.ts](src/shared/db/schema.ts)) lets "add a country = edit the registry" stay true all the way down to the database. Worth stressing: the data is fully validated *before* it lands, so the flexibility is only in how it's stored, never in the contract itself.

4. **Strict layering: routes call services, services call the repository.**
   It's enforced by convention and ESLint. The repository is the only file allowed to touch the DB client, the services hold the logic with no framework imports, and the routes just parse and delegate. The nice payoff is that the validation and schema-derivation logic is unit-testable on its own, no live socket or database required.

5. **Boring, production-shaped defaults, on purpose.**
   RFC 7807 `problem+json` errors, pino with secret redaction, env validated once at boot through a single Zod chokepoint, OpenAPI generated from the same schemas, graceful shutdown. None of it is clever, and that's the point. I wanted something that reads like a service a team would actually be happy to maintain.

6. **Forgiving on input, strict on storage.**
   `us`, `US`, and `usa`, plus ISO alpha-2 codes like `US` (which maps to `USA`), all resolve to one canonical code. Easy on the caller, tidy in the database.

### Trade-offs (the limits I accepted, and why I'm OK with them here)

| Decision | The trade-off | Why it's fine for this scope, and what I'd do at scale |
|---|---|---|
| `jsonb` for the address fields | No DB-level constraints on individual fields, and you can't cheaply index or filter on something like `city` | Bad data can't get in, because validation happens at the app boundary via the registry-derived schema. The day addresses need real querying or reporting, I'd add generated columns or promote the hot fields into proper columns. |
| Registry lives in code, not a DB table | Adding a country is a deploy, not a runtime config change | A take-home doesn't need a CMS for countries. The registry is deliberately shaped as data rather than logic, so lifting it into a table later is a mechanical change, not a rewrite. |
| Rules expressed as `length` / `numeric` / `pattern` | It's not a full international address grammar (no per-state ZIP ranges, no checksum rules) | It covers the brief's stated rules exactly, and the `pattern` escape hatch handles anything fancier without schema changes. |
| Google Places autocomplete is frontend-only | The backend never sees or validates the Places payload; it stores whatever the form submits | That matches the brief, where Places is a convenience for entry. The backend's contract is the country field set, and it validates that no matter how the form got filled in. |
| No auth, rate limiting, or multi-tenancy | The endpoints are open | Out of scope for a demo. The error hierarchy and plugin structure leave clean seams to add that later without reshaping the features. |
| Order by `created_at` with offset pagination | Offset pagination gets slow on very large tables | Fine for a demo retrieve endpoint. There's already a `created_at` index, and moving to cursor pagination is a contained change in the repository. |

### If I'd had more than the timebox

I'd add cursor-based pagination, a small integration test against a throwaway Postgres (testcontainers) that runs the full POST then GET round-trip for each country, and I'd promote `country_code` plus a couple of hot fields out of `jsonb` once real query patterns made the case for it.

## Step-by-Step AI Workflow
1. Initiate the repo by prompting to AI:
```
/senior-be-architect, initiate Fastify, Typescript
```

2. Init [spec-kit](https://github.com/github/spec-kit)
3. Run in terminal agents:
```
/speckit-constitution add principles for this project that will cater all the needs 
  in this reqs (for BE only):                                                                       
  Background                                                                          
                                                                                      
  AcmeCorp is building a new customer onboarding flow that collects user addresses.   
  Since addresses vary by country, the company needs a dynamic form system that       
  adapts based on the selected country.                                               
                                                                                      
  The design requirements are:                                                        
                                                                                      
  - Country dropdown at the top of the page.                                          
                                                                                      
  - Address input with Google Places autocomplete for quick entry.                    
                                                                                      
  - A “Manually Edit” button that switches the form into manual entry mode.           
                                                                                      
  - In manual mode, the form layout should dynamically adjust fields based on the     
  selected country.                                                                   
                                                                                      
  - Captured addresses must be saved to a backend service and stored in a database.   
                                                                                      
  Supported Countries & Field Layouts                                                 
                                                                                      
  1. United States (USA)                                                              
                                                                                      
  - Address Line 1 (required)                                                         
                                                                                      
  - Address Line 2 (optional)                                                         
                                                                                      
  - City (required)                                                                   
                                                                                      
  - State (dropdown: e.g., CA, NY, TX)                                                
                                                                                      
  - ZIP Code (5-digit, required)                                                      
                                                                                      
  2. Australia (AUS)                                                                  
                                                                                      
  - Address Line 1 (required)                                                         
                                                                                      
  - Address Line 2 (optional)                                                         
                                                                                      
  - Suburb (required)                                                                 
                                                                                      
  - State (dropdown: NSW, VIC, QLD, WA, SA, TAS, ACT, NT)                             
                                                                                      
  - Postcode (4-digit, required)                                                      
                                                                                      
  3. Indonesia (IDN)                                                                  
                                                                                      
  - Province (dropdown: e.g., Jawa Barat, Bali, Sumatra Utara)                        
                                                                                      
  - City / Regency (required)                                                         
                                                                                      
  - District (Kecamatan, required)                                                    
                                                                                      
  - Village (Kelurahan/Desa, optional)                                                
                                                                                      
  - Postal Code (required, 5-digit)                                                   
                                                                                      
  - Street Address (required)                                                         
                                                                                      
Your Task (Timebox: 2 hours)                                                          
                                                                                      
Build a small end-to-end application that demonstrates this feature.                  
                                                                                      
Frontend Requirements                                                                 
                                                                                      
- Dropdown to select country.                                                         
                                                                                      
- Address input with Google Places autocomplete integration.                          
                                                                                      
- “Manually Edit” button that dynamically renders address fields appropriate to the   
country.                                                                              
                                                                                      
- Validation for required fields (configurable per country).                          
                                                                                      
- Clean, responsive UI.                                                               
                                                                                      
Backend Requirements                                                                  
                                                                                      
- API to receive and store address data.                                              
                                                                                      
- Simple database schema for addresses (e.g., country, city, postal code, line1,      
line2, etc.).                                                                         
                                                                                      
- API to retrieve saved addresses (for demo purposes).                                
                                                                                      
Notes                                                                                 
                                                                                      
- Please use the React framework.                                                     
                                                                                      
- For backend, use a lightweight framework (Express, Hono, Fastify).                  
                                                                                      
- Database can be in-memory (SQLite) or mock if needed.                               
                                                                                      
- Bonus: show how you would design the API to support dynamic country-specific        
metadata (field names, validation rules).
```
4. Run in terminal agent:
```
/speckit-specify
```
5. Run in terminal agent:
```
/speckit-plan
```
6. Run in terminal agent:
```
/speckit-tasks
```
7. Run in terminal agent:
```
/speckit-implement
```
8. To review my changes, Run in terminal agent:
```
/senior-backend-reviewer, review all the pushed changes here before I create the PR. 
```