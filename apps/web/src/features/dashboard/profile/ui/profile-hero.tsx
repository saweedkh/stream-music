"use client";

import { Calendar } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { UserVerifiedBadge } from "@/shared/ui/user-verified-badge";
import { ProfileAvatarEditor } from "@/features/dashboard/profile/ui/profile-avatar-editor";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

type ProfileHeroProps = {
  user: AuthUser;
  displayName: string;
  memberSinceLabel: string | null;
  channelCount: number;
  trackCount: number;
  playlistCount: number;
  avatarBusy?: boolean;
  onAvatarUpload: (file: File) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
};

export function ProfileHero({
  user,
  displayName,
  memberSinceLabel,
  channelCount,
  trackCount,
  playlistCount,
  avatarBusy,
  onAvatarUpload,
  onAvatarRemove,
}: ProfileHeroProps) {
  const { t } = useTranslations();

  const stats = [
    { label: t("profile.statChannels"), value: channelCount },
    { label: t("profile.statTracks"), value: trackCount },
    { label: t("profile.statPlaylists"), value: playlistCount },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,hsl(var(--brand)/0.14),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(139,92,246,0.07),transparent_50%)]"
        aria-hidden
      />

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <ProfileAvatarEditor
            username={user.username}
            displayName={displayName}
            avatarUrl={user.avatar_url}
            disabled={avatarBusy}
            onUpload={onAvatarUpload}
            onRemove={onAvatarRemove}
          />

          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("profile.heroEyebrow")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {displayName}
              </h2>
              <UserVerifiedBadge flags={user} size="sm" />
            </div>
            <p className="truncate font-mono text-sm text-muted-foreground">@{user.username}</p>
            {memberSinceLabel ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {memberSinceLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:max-w-xs sm:shrink-0">
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border border-[var(--workspace-divider)]/80",
                "bg-background/50 px-2 py-2.5 text-center backdrop-blur-sm",
              )}
            >
              <span className="text-lg font-semibold tabular-nums leading-none text-foreground">{value}</span>
              <span className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
