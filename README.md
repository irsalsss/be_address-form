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