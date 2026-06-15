import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// addresses — captured, country-shaped address records.
// `fields` stores the full validated submission (country-specific keys) so a
// record reads back with the same field semantics it was submitted with.
// See specs/001-address-capture-api/data-model.md
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: varchar("country_code", { length: 3 }).notNull(),
    fields: jsonb("fields").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addresses_created_at_idx").on(t.createdAt)],
);

export type AddressRow = typeof addresses.$inferSelect;
export type NewAddressRow = typeof addresses.$inferInsert;

// countries — DB-backed country address-form metadata (field layouts + rules).
// The whole field layout is read and written as one document, so it lives in a
// single `fields` jsonb column rather than normalized child tables. The seed
// (src/shared/db/seed.ts) loads the canonical definitions from
// features/countries/registry.ts. `fields` is typed loosely here because
// `shared/` must not import from `features/` (CLAUDE.md layering); the countries
// repository casts it to CountryFieldDef[] on read.
export const countries = pgTable("countries", {
  code: varchar("code", { length: 3 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  fields: jsonb("fields").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CountryRow = typeof countries.$inferSelect;
export type NewCountryRow = typeof countries.$inferInsert;
