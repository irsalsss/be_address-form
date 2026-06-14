import { eq, desc } from "drizzle-orm";
import { db } from "../../shared/db/client.js";
import { addresses, type AddressRow } from "../../shared/db/schema.js";
import { InternalError } from "../../shared/errors.js";

// Only file in the addresses feature permitted to import `db` (Principle III).

export async function insertAddress(
  countryCode: string,
  fields: Record<string, string>,
): Promise<AddressRow> {
  const [row] = await db
    .insert(addresses)
    .values({ countryCode, fields })
    .returning();
  // `.returning()` always yields the inserted row; guard for the type only.
  if (!row) throw new InternalError("insert returned no row");
  return row;
}

export async function listAddresses(): Promise<AddressRow[]> {
  return db.select().from(addresses).orderBy(desc(addresses.createdAt));
}

export async function findAddressById(id: string): Promise<AddressRow | null> {
  const [row] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
  return row ?? null;
}
