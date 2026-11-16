import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * Locale is per-browser, stored in the `locale` cookie ("en" | "fr").
 * No route prefixes — every existing deep link keeps working; emails and
 * notification deep links are locale-agnostic. The cookie is set by
 * setLocaleAction from anywhere the user can switch language.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale = raw === "fr" ? "fr" : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
