export { countriesRoutes } from "./routes.js";
export {
  buildAddressValidator,
  listCountries,
  getCountryFields,
  createCountry,
  updateCountry,
} from "./service.js";
export { canonicalizeCode, hashCountryFields, isSafePattern } from "./registry.js";
export type { CountryCode } from "./registry.js";
