import { seedCountryEntries } from "./registry.js";
import { insertCountry } from "./repository.js";

// Idempotent seed of the built-in countries into the `countries` table.
// Uses insertCountry's ON CONFLICT DO NOTHING, so re-running never overwrites a
// country that already exists (incl. one edited via the API). Reusable from the
// CLI runner (seed-cli.ts) and from test setup.
export async function seedCountries(): Promise<{
  inserted: number;
  skipped: number;
}> {
  let inserted = 0;
  let skipped = 0;
  for (const country of seedCountryEntries()) {
    const created = await insertCountry(country);
    if (created) inserted += 1;
    else skipped += 1;
  }
  return { inserted, skipped };
}
