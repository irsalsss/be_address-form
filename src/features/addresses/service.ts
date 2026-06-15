import { NotFoundError } from "../../shared/errors.js";
import { buildAddressValidator } from "../countries/index.js";
import type { AddressRow } from "../../shared/db/schema.js";
import {
  insertAddress,
  listAddresses,
  findAddressById,
} from "./repository.js";
import type { AddressResponse, CreateAddressRequest } from "./schemas.js";

// Pure logic — no Fastify imports (Principle III).

function toResponse(row: AddressRow): AddressResponse {
  return {
    id: row.id,
    country: row.countryCode,
    fields: row.fields,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createAddress(
  input: CreateAddressRequest,
): Promise<AddressResponse> {
  // Build the country's strict validator from the registry and parse `fields`.
  // A bad country throws BadRequestError; bad fields throw ZodError → 400.
  const { code, schema } = await buildAddressValidator(input.country);
  const fields = schema.parse(input.fields) as Record<string, string>;

  const row = await insertAddress(code, fields);
  return toResponse(row);
}

export async function getAllAddresses(
  limit = 50,
  offset = 0,
): Promise<{ addresses: AddressResponse[]; limit: number; offset: number }> {
  const rows = await listAddresses(limit, offset);
  return { addresses: rows.map(toResponse), limit, offset };
}

export async function getAddressById(id: string): Promise<AddressResponse> {
  const row = await findAddressById(id);
  if (!row) throw new NotFoundError(`address not found: ${id}`);
  return toResponse(row);
}
