/**
 * Active-locale tag for Intl formatting.
 * Client: reads <html lang> set by the root layout from the locale cookie.
 * Server: callers pass the request locale (next-intl getLocale()).
 * Falls back to en-GB so demo mode and non-localized paths behave as before.
 */
export function appLocaleTag(requestLocale?: string | null): string {
  const fromDoc =
    typeof document !== "undefined" ? document.documentElement?.lang : undefined;
  const raw = (fromDoc && fromDoc.length > 0 ? fromDoc : requestLocale) ?? "en";
  return raw.toLowerCase().startsWith("fr") ? "fr-FR" : "en-GB";
}

/** Display name for a booking category — FR when available and active, else EN. */
export function categoryName(
  cat: { name_en: string; name_fr?: string | null } | undefined | null,
  locale: string,
): string {
  if (!cat) return "";
  return locale.toLowerCase().startsWith("fr") && cat.name_fr ? cat.name_fr : cat.name_en;
}
