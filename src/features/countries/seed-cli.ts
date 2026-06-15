import { closeDb } from "../../shared/db/client.js";
import { logger } from "../../shared/logger.js";
import { seedCountries } from "./seed.js";

// CLI entry for `pnpm db:seed`. Seeds built-in countries, then closes the pool
// so the process exits. Idempotent — safe to run after every migrate.
const result = await seedCountries();
logger.info(result, "country seed complete");
await closeDb();
