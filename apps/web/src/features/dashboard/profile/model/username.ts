export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isUsernameFormatValid(value: string): boolean {
  const normalized = normalizeUsername(value);
  return normalized.length >= USERNAME_MIN && normalized.length <= USERNAME_MAX && USERNAME_PATTERN.test(normalized);
}
