import { z, type ZodTypeAny } from "zod";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors.js";
import {
  canonicalizeCode,
  hashCountryFields,
  isSafePattern,
  type Country,
  type CountryFieldDef,
} from "./registry.js";
import {
  insertCountry,
  selectAllCountries,
  selectCountryByCode,
  updateCountry as updateCountryRow,
} from "./repository.js";
import type { CountrySummary, CountryFieldsResponse, WriteCountryRequest } from "./schemas.js";

// --- Turn stored country rows into API response objects ---

export async function listCountries(): Promise<CountrySummary[]> {
  const all = await selectAllCountries();
  return all.map((c) => ({
    code: c.code,
    name: c.name,
    version: hashCountryFields(c.fields),
  }));
}

function toFieldsResponse(country: Country): CountryFieldsResponse {
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

export async function getCountryFields(codeInput: string): Promise<CountryFieldsResponse> {
  const code = canonicalizeCode(codeInput);
  const country = code ? await selectCountryByCode(code) : null;
  if (!country) throw new NotFoundError(`unsupported country: ${codeInput}`);
  return toFieldsResponse(country);
}

// --- Build the submit-time validator from the same stored row as metadata (FR-014) ---

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
    const src = field.validation.numeric ? (len ? `^\\d{${len}}$` : `^\\d+$`) : `^.{${len}}$`;
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
export async function buildAddressValidator(codeInput: string): Promise<{
  code: string;
  schema: z.ZodObject<Record<string, ZodTypeAny>>;
}> {
  const code = canonicalizeCode(codeInput);
  const country = code ? await selectCountryByCode(code) : null;
  if (!country) throw new BadRequestError(`unsupported country: ${codeInput}`);

  const shape: Record<string, ZodTypeAny> = {};
  for (const field of country.fields) shape[field.key] = fieldSchema(field);

  return { code: country.code, schema: z.object(shape).strict() };
}

// --- Write path: author countries at runtime (admin) ------------------------

/**
 * Structural validation runs in the route via Zod. Here we enforce the two
 * security/consistency rules that Zod can't express cleanly:
 *  - Guard 1: every regex `pattern` must be ReDoS-safe (isSafePattern).
 *  - a dropdown field must carry at least one option, else the derived submit
 *    validator would reject every value.
 * Throws BadRequestError (→ 400) on violation.
 */
function assertFieldsAreSafe(fields: CountryFieldDef[]): void {
  const keys = new Set<string>();
  for (const f of fields) {
    if (keys.has(f.key)) {
      throw new BadRequestError(`duplicate field key: ${f.key}`);
    }
    keys.add(f.key);

    if (f.type === "dropdown" && (f.options?.length ?? 0) === 0) {
      throw new BadRequestError(`dropdown field "${f.key}" needs at least one option`);
    }
    const pattern = f.validation?.pattern;
    if (pattern !== undefined && !isSafePattern(pattern)) {
      throw new BadRequestError(`field "${f.key}" has an unsafe or invalid regex pattern`);
    }
  }
}

function toCountry(input: WriteCountryRequest, code: string): Country {
  return {
    code,
    name: input.name,
    // Drop any client-sent `order`; field order is positional in the array.
    fields: input.fields.map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      type: f.type,
      ...(f.options ? { options: f.options } : {}),
      ...(f.validation ? { validation: f.validation } : {}),
    })),
  };
}

export async function createCountry(input: WriteCountryRequest): Promise<CountryFieldsResponse> {
  const code = canonicalizeCode(input.code);
  if (!code) throw new BadRequestError(`invalid country code: ${input.code}`);
  assertFieldsAreSafe(input.fields as CountryFieldDef[]);

  const created = await insertCountry(toCountry(input, code));
  if (!created) throw new ConflictError(`country already exists: ${code}`);
  return toFieldsResponse(created);
}

export async function updateCountry(
  codeInput: string,
  input: WriteCountryRequest,
): Promise<CountryFieldsResponse> {
  const code = canonicalizeCode(codeInput);
  if (!code) throw new BadRequestError(`invalid country code: ${codeInput}`);
  assertFieldsAreSafe(input.fields as CountryFieldDef[]);

  const updated = await updateCountryRow(code, toCountry(input, code));
  if (!updated) throw new NotFoundError(`unsupported country: ${codeInput}`);
  return toFieldsResponse(updated);
}
