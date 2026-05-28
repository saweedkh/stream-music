"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Calendar,
  Check,
  KeyRound,
  Languages,
  LayoutGrid,
  ListMusic,
  Loader2,
  Moon,
  Music,
  Palette,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import type { ProfileSection } from "@/features/dashboard/model/dashboard-nav-config";
import { useTranslations } from "@/shared/providers/locale-provider";
import { UserVerifiedBadge } from "@/shared/ui/user-verified-badge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";
import { NotificationPreferencesCard } from "@/features/dashboard/components/notification-preferences-card";
import { getMe, patchMeProfile, patchMePublicProfile, postChangePassword, type AuthUser } from "@/lib/api";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { dispatchUserSessionRefresh } from "@/lib/user-session-events";
import { cn } from "@/lib/utils";

const LOCALE_LABEL_KEYS = {
  en: "lang.en",
  fa: "lang.fa",
} as const satisfies Record<Locale, "lang.en" | "lang.fa">;

export type { ProfileSection } from "@/features/dashboard/model/dashboard-nav-config";

export type UserProfileHubProps = {
  activeSection: ProfileSection;
  channelCount: number;
  trackCount: number;
  playlistCount: number;
};

function formatMemberSince(iso: string | undefined, locale: Locale): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function UserProfileHub({ activeSection, channelCount, trackCount, playlistCount }: UserProfileHubProps) {
  const { t, locale, setLocale } = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      const u = me?.user ?? null;
      setUser(u);
      if (u) {
        setEmail(u.email ?? "");
        setFirstName(u.first_name ?? "");
        setLastName(u.last_name ?? "");
        setBio(u.bio ?? "");
        setIsPublic(Boolean(u.is_public));
      }
    } catch {
      showToast(t("profile.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = useMemo(() => {
    if (!user) return "";
    const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    return full || user.username;
  }, [user]);

  const memberSinceLabel = useMemo(() => {
    const formatted = formatMemberSince(user?.date_joined, locale);
    if (!formatted) return null;
    return t("profile.memberSince", { date: formatted });
  }, [locale, t, user?.date_joined]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const [me] = await Promise.all([
        patchMeProfile({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
        patchMePublicProfile({ bio: bio.trim(), is_public: isPublic }),
      ]);
      setUser({ ...me.user, bio: bio.trim(), is_public: isPublic });
      showToast(t("profile.profileSaved"), "success");
      dispatchUserSessionRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("profile.loadFailed"), "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast(t("profile.passwordTooShort"), "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t("profile.passwordMismatch"), "error");
      return;
    }
    setSavingPassword(true);
    try {
      await postChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(t("profile.passwordChanged"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("profile.loadFailed"), "error");
    } finally {
      setSavingPassword(false);
    }
  }

  const isDark = mounted && resolvedTheme === "dark";

  if (loading) {
    return (
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(200px,240px)_1fr] md:gap-5">
        <Skeleton className="h-72 rounded-2xl md:order-1" />
        <div className="flex flex-col gap-4 md:order-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="border-dashed border-border/70 bg-muted/10">
        <CardHeader>
          <CardTitle>{t("guard.notLoggedIn")}</CardTitle>
          <CardDescription>{t("auth.needAccount")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">{t("guard.goToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overviewHero = (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-6 sm:p-8",
        "from-brand/[0.12] via-card to-card shadow-sm shadow-black/5",
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 shrink-0 ring-4 ring-brand/20 sm:h-24 sm:w-24">
            <AvatarFallback className="bg-gradient-to-br from-brand/35 to-brand/5 text-2xl font-bold text-brand sm:text-3xl">
              {(user.username || "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.heroEyebrow")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{displayName}</h2>
              <UserVerifiedBadge flags={user} size="md" />
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t("profile.heroSubtitle")}</p>
            <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
            {memberSinceLabel ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                {memberSinceLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3 lg:w-[min(100%,22rem)]">
          {[
            { icon: LayoutGrid, value: channelCount, label: t("profile.statChannels") },
            { icon: Music, value: trackCount, label: t("profile.statTracks") },
            { icon: ListMusic, value: playlistCount, label: t("profile.statPlaylists") },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/40 px-2 py-3 text-center backdrop-blur-sm"
            >
              <Icon className="mb-1 h-4 w-4 text-brand/80" aria-hidden />
              <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-w-0 space-y-5">
        {activeSection === "overview" ? overviewHero : null}

        {activeSection === "profile" ? (
          <Card className="border-border/60 bg-card/50 shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/12 text-brand">
                  <User className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-lg">{t("profile.accountTitle")}</CardTitle>
                  <CardDescription>{t("profile.accountDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => void handleSaveProfile(e)}>
                <div className="space-y-2">
                  <Label htmlFor="profile-username">{t("profile.username")}</Label>
                  <Input id="profile-username" value={user.username} readOnly className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">{t("profile.email")}</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-first">{t("profile.firstName")}</Label>
                    <Input id="profile-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-last">{t("profile.lastName")}</Label>
                    <Input id="profile-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-bio">{t("profile.public.bio")}</Label>
                  <Input id="profile-bio" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  {t("profile.public.isPublic")}
                </label>
                {isPublic && user ? (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/users/${user.username}`} className="text-brand underline-offset-2 hover:underline">
                      {t("profile.public.publicHint", { username: user.username })}
                    </Link>
                  </p>
                ) : null}
                <Button type="submit" disabled={savingProfile} className="gap-2">
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {t("profile.saveProfile")}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "appearance" ? (
          <Card className="border-border/60 bg-card/50 shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400">
                  <Palette className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-lg">{t("profile.appearanceTitle")}</CardTitle>
                  <CardDescription>{t("profile.appearanceDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                disabled={!mounted}
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/15 p-3 text-start transition-colors",
                  "hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                  "disabled:opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    isDark ? "bg-amber-500/15 text-amber-500" : "bg-indigo-500/15 text-indigo-400",
                  )}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {isDark ? t("theme.toLight") : t("theme.toDark")}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("theme.toggle")}</span>
                </span>
              </button>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Languages className="h-3 w-3" aria-hidden />
                  {t("lang.switch")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LOCALES.map((code) => {
                    const active = locale === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "border-brand/40 bg-brand/12 text-brand shadow-sm shadow-brand/10"
                            : "border-transparent bg-muted/25 text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                        )}
                        onClick={() => setLocale(code)}
                      >
                        {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                        {t(LOCALE_LABEL_KEYS[code])}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "security" ? (
          <Card className="border-border/60 bg-card/50 shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-lg">{t("profile.securityTitle")}</CardTitle>
                  <CardDescription>{t("profile.securityDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => void handleChangePassword(e)}>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="pw-current">{t("profile.currentPassword")}</Label>
                  <Input
                    id="pw-current"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="pw-new">{t("profile.newPassword")}</Label>
                  <Input
                    id="pw-new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="pw-confirm">{t("profile.confirmPassword")}</Label>
                  <Input
                    id="pw-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit" variant="secondary" disabled={savingPassword} className="gap-2">
                    {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {t("profile.changePassword")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "notifications" ? <NotificationPreferencesCard /> : null}
    </div>
  );
}
