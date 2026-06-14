export { countriesRoutes } from "./routes.js";
export {
  buildAddressValidator,
  listCountries,
  getCountryFields,
} from "./service.js";
export {
  isSupportedCountry,
  normalizeCountryCode,
  hashCountryFields,
} from "./registry.js";
export type { CountryCode } from "./registry.js";
