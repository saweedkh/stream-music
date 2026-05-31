"use client";

import { useTranslations } from "@/shared/providers/locale-provider";
import { ProfileViewPublicLink } from "@/features/dashboard/profile/ui/profile-view-public-cta";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/lib/utils";

type ProfilePublicToggleProps = {
  username: string;
  isPublic: boolean;
  onIsPublicChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function ProfilePublicToggle({
  username,
  isPublic,
  onIsPublicChange,
  disabled,
  className,
}: ProfilePublicToggleProps) {
  const { t } = useTranslations();

  return (
    <div className={cn("sm:col-span-2 border-t border-[var(--workspace-divider)] pt-5", className)}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="account-public" className="text-sm font-medium text-foreground">
            {t("profile.public.isPublic")}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("profile.publicVisibilityHint")}</p>
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
              isPublic
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isPublic ? t("profile.publicProfileOn") : t("profile.publicProfileOff")}
          </span>
        </div>
        <Switch
          id="account-public"
          checked={isPublic}
          disabled={disabled}
          className="shrink-0"
          aria-label={t("profile.public.isPublic")}
          onCheckedChange={onIsPublicChange}
        />
      </div>

      {isPublic ? (
        <ProfileViewPublicLink username={username} />
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("profile.viewPublicPageDisabled")}</p>
      )}
    </div>
  );
}
