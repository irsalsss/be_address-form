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
