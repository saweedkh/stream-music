import { messages, translate, type MessageKey } from "@/lib/i18n/messages";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "@/lib/i18n/types";

const API_CODE_RE = /^[a-z][a-z0-9_]*$/;

export function getClientLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function localizeMessage(message: string, locale?: Locale): string {
  const trimmed = message.trim();
  if (!API_CODE_RE.test(trimmed)) return message;
  const key = `api.error.${trimmed}` as MessageKey;
  if (!(key in messages.en)) return message;
  return translate(locale ?? getClientLocale(), key);
}

export function localizeMessageWithVars(
  message: string,
  vars: Record<string, string | number>,
  locale?: Locale,
): string {
  const trimmed = message.trim();
  if (!API_CODE_RE.test(trimmed)) return message;
  const key = `api.error.${trimmed}` as MessageKey;
  if (!(key in messages.en)) return message;
  return translate(locale ?? getClientLocale(), key, vars);
}
