import { asc, eq } from "drizzle-orm";
import { db } from "../../shared/db/client.js";
import { countries, type CountryRow } from "../../shared/db/schema.js";
import type { Country, CountryFieldDef } from "./registry.js";

// Only file in the countries feature permitted to import `db` (CLAUDE.md
// layering). `fields` is stored as jsonb; it was validated by a Zod write-schema
// before it was ever written, so the read-side cast is safe.

function toCountry(row: CountryRow): Country {
  return {
    code: row.code,
    name: row.name,
    fields: row.fields as CountryFieldDef[],
  };
}

export async function selectAllCountries(): Promise<Country[]> {
  const rows = await db.select().from(countries).orderBy(asc(countries.code));
  return rows.map(toCountry);
}

export async function selectCountryByCode(code: string): Promise<Country | null> {
  const [row] = await db
    .select()
    .from(countries)
    .where(eq(countries.code, code))
    .limit(1);
  return row ? toCountry(row) : null;
}

/**
 * Insert a new country. Returns null if the code already exists (the PK
 * conflict is the authoritative duplicate guard — no read-then-write race).
 */
export async function insertCountry(country: Country): Promise<Country | null> {
  const [row] = await db
    .insert(countries)
    .values({ code: country.code, name: country.name, fields: country.fields })
    .onConflictDoNothing()
    .returning();
  return row ? toCountry(row) : null;
}

/**
 * Replace an existing country's name + fields. Returns null if no row matched
 * (country does not exist). Bumps `updated_at`.
 */
export async function updateCountry(
  code: string,
  country: Country,
): Promise<Country | null> {
  const [row] = await db
    .update(countries)
    .set({ name: country.name, fields: country.fields, updatedAt: new Date() })
    .where(eq(countries.code, code))
    .returning();
  return row ? toCountry(row) : null;
}
