import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient);
export type DB = typeof db;

/** Close the connection pool. For short-lived scripts (e.g. db:seed) so the
 *  process can exit; the long-running server relies on graceful shutdown. */
export async function closeDb(): Promise<void> {
  await queryClient.end();
}
