import { z, type ZodTypeAny } from "zod";
import { NotFoundError, BadRequestError } from "../../shared/errors.js";
import {
  type Country,
  type CountryFieldDef,
  getCountry,
  listCountryEntries,
  normalizeCountryCode,
} from "./registry.js";
import type { CountrySummary, CountryFieldsResponse } from "./schemas.js";

// --- Metadata projections (registry → API DTOs) ---

export function listCountries(): CountrySummary[] {
  return listCountryEntries().map((c) => ({ code: c.code, name: c.name }));
}

export function getCountryFields(codeInput: string): CountryFieldsResponse {
  const code = normalizeCountryCode(codeInput);
  if (!code) throw new NotFoundError(`unsupported country: ${codeInput}`);
  const country = getCountry(code);
  return {
    code: country.code,
    name: country.name,
    fields: country.fields.map((f, order) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      type: f.type,
      options: f.options,
      validation: f.validation,
      order,
    })),
  };
}

// --- Submit-time validator derivation (same registry as metadata → FR-014) ---

function fieldSchema(field: CountryFieldDef): ZodTypeAny {
  let base: ZodTypeAny;

  if (field.type === "dropdown") {
    const values = (field.options ?? []).map((o) => o.value);
    base = z.enum(values as [string, ...string[]]);
  } else if (field.validation?.pattern) {
    base = z.string().regex(new RegExp(field.validation.pattern));
  } else if (field.validation?.numeric || field.validation?.length) {
    const len = field.validation.length;
    const src = field.validation.numeric
      ? len
        ? `^\\d{${len}}$`
        : `^\\d+$`
      : `^.{${len}}$`;
    base = z.string().regex(new RegExp(src));
  } else {
    base = z.string().trim().min(1);
  }

  return field.required ? base : base.optional();
}

/**
 * Build a strict Zod object schema for a country's submitted `fields`.
 * `.strict()` rejects unknown keys so junk is never stored as valid (SC-002).
 * Throws BadRequestError for an unsupported country.
 */
export function buildAddressValidator(codeInput: string): {
  code: Country["code"];
  schema: z.ZodObject<Record<string, ZodTypeAny>>;
} {
  const code = normalizeCountryCode(codeInput);
  if (!code) throw new BadRequestError(`unsupported country: ${codeInput}`);
  const country = getCountry(code);

  const shape: Record<string, ZodTypeAny> = {};
  for (const field of country.fields) shape[field.key] = fieldSchema(field);

  return { code, schema: z.object(shape).strict() };
}
