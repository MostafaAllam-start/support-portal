import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Each namespace lives in its own file under locale/<locale>/<Namespace>.json.
// Add a new feature's namespace here after creating its JSON file in every locale.
const NAMESPACES = [
  "Brand",
  "Auth",
  "Home",
  "LocaleSwitcher",
  "Common",
  "Landing",
  "ContactCard",
  "Dashboard",
  "Tickets",
  "CompanySelect",
  "Profile",
  "Emails",
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Load and merge every namespace file into a single messages object.
  const namespaces = await Promise.all(
    NAMESPACES.map(
      async (namespace) =>
        [
          namespace,
          (await import(`../locale/${locale}/${namespace}.json`)).default,
        ] as const,
    ),
  );

  return {
    locale,
    messages: Object.fromEntries(namespaces),
  };
});
