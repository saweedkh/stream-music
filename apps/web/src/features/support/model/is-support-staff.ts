import type { AuthUser } from "@/lib/api";

export function isSupportStaff(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.is_staff || user?.is_superuser);
}
