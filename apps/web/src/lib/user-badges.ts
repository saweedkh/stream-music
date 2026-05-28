/** User badge payloads from the API. */

export type UserBadge = {
  slug: string;
  label: string;
  description?: string;
  icon: string;
  color: string;
  priority: number;
  is_system?: boolean;
};

export type UserBadgeFlags = {
  is_staff?: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
};

export function resolveUserBadges(flags: UserBadgeFlags | null | undefined): UserBadge[] {
  if (!flags) return [];
  if (flags.badges?.length) {
    return [...flags.badges].sort((a, b) => a.priority - b.priority || a.slug.localeCompare(b.slug));
  }
  const legacy: UserBadge[] = [];
  if (flags.is_superuser) {
    legacy.push({
      slug: "platform_superuser",
      label: "Platform admin",
      icon: "crown",
      color: "amber",
      priority: 10,
      is_system: true,
    });
  } else if (flags.is_staff) {
    legacy.push({
      slug: "platform_staff",
      label: "Staff",
      icon: "badge-check",
      color: "sky",
      priority: 20,
      is_system: true,
    });
  }
  if (flags.is_premium) {
    legacy.push({
      slug: "premium",
      label: "Premium",
      icon: "sparkles",
      color: "violet",
      priority: 30,
      is_system: true,
    });
  }
  return legacy;
}

export function hasStaffBadge(flags: UserBadgeFlags | null | undefined): boolean {
  return resolveUserBadges(flags).some((b) => b.slug === "platform_staff");
}

export function hasSuperuserBadge(flags: UserBadgeFlags | null | undefined): boolean {
  return resolveUserBadges(flags).some((b) => b.slug === "platform_superuser");
}

export function hasPremiumBadge(flags: UserBadgeFlags | null | undefined): boolean {
  return resolveUserBadges(flags).some((b) => b.slug === "premium");
}

/** Manual badge slugs currently on a user (premium, custom, …). */
export function manualBadgeSlugsForUser(
  definitions: UserBadge[],
  current: UserBadgeFlags | null | undefined,
): string[] {
  const resolved = resolveUserBadges(current);
  const active = new Set(resolved.map((b) => b.slug));
  return definitions
    .filter((b) => b.slug !== "platform_superuser" && b.slug !== "platform_staff")
    .filter((b) => active.has(b.slug))
    .map((b) => b.slug);
}
