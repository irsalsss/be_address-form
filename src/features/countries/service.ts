import { z, type ZodTypeAny } from "zod";
import { NotFoundError, BadRequestError } from "../../shared/errors.js";
import {
  type Country,
  type CountryFieldDef,
  getCountry,
  hashCountryFields,
  listCountryEntries,
  normalizeCountryCode,
} from "./registry.js";
import type { CountrySummary, CountryFieldsResponse } from "./schemas.js";

// --- Turn registry data into API response objects ---

export function listCountries(): CountrySummary[] {
  return listCountryEntries().map((c) => ({
    code: c.code,
    name: c.name,
    version: hashCountryFields(c.fields),
  }));
}

export function getCountryFields(codeInput: string): CountryFieldsResponse {
  const code = normalizeCountryCode(codeInput);
  if (!code) throw new NotFoundError(`unsupported country: ${codeInput}`);
  const country = getCountry(code);
  return {
    code: country.code,
    name: country.name,
    version: hashCountryFields(country.fields),
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

// --- Build the submit-time validator from the same registry as metadata (FR-014) ---

function fieldSchema(field: CountryFieldDef): ZodTypeAny {
  // Messages are human-readable and field-labelled because clients surface them
  // verbatim next to the offending input (they are not i18n keys).
  const { label } = field;
  const required = `${label} is required`;
  let base: ZodTypeAny;

  if (field.type === "dropdown") {
    const values = (field.options ?? []).map((o) => o.value);
    base = z.enum(values as [string, ...string[]], {
      error: `${label} must be one of the listed options`,
    });
  } else if (field.validation?.pattern) {
    base = z
      .string({ error: required })
      .regex(new RegExp(field.validation.pattern), `${label} has an invalid format`);
  } else if (field.validation?.numeric || field.validation?.length) {
    const len = field.validation.length;
    const src = field.validation.numeric
      ? len
        ? `^\\d{${len}}$`
        : `^\\d+$`
      : `^.{${len}}$`;
    const msg = field.validation.numeric
      ? len
        ? `${label} must be exactly ${len} digits`
        : `${label} must contain only digits`
      : `${label} must be exactly ${len} characters`;
    base = z.string({ error: required }).regex(new RegExp(src), msg);
  } else {
    // Free text: limit the length so very long values can't bloat the jsonb row.
    const max = field.validation?.maxLength ?? 200;
    base = z
      .string({ error: required })
      .trim()
      .min(1, required)
      .max(max, `${label} must be at most ${max} characters`);
  }

  if (field.required) return base;
  // Optional fields: clients send empty strings for untouched inputs, so treat
  // a blank/whitespace value as "not provided" instead of failing min-length.
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    base.optional(),
  );
}

/**
 * Builds a strict Zod object schema for a country's submitted `fields`.
 * `.strict()` blocks unknown keys, so bad data is never stored as valid
 * (SC-002). Throws BadRequestError if the country is not supported.
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
