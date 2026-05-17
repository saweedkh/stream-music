export const LOCALES = ["en", "fa"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = "stream-music-locale";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "fa";
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "fa" ? "rtl" : "ltr";
}
