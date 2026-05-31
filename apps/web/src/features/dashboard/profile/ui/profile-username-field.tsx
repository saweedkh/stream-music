"use client";

import { Check, Loader2, X } from "lucide-react";
import type { UsernameAvailabilityStatus } from "@/features/dashboard/profile/hooks/use-username-availability";
import { USERNAME_MAX, USERNAME_MIN } from "@/features/dashboard/profile/model/username";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type ProfileUsernameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  status: UsernameAvailabilityStatus;
  disabled?: boolean;
};

export function ProfileUsernameField({ value, onChange, status, disabled }: ProfileUsernameFieldProps) {
  const { t } = useTranslations();

  const isValid = status === "available" || status === "unchanged";
  const isInvalid = status === "taken" || status === "invalid";

  const hint =
    status === "checking"
      ? t("profile.usernameChecking")
      : status === "available"
        ? t("profile.usernameAvailable")
        : status === "taken"
          ? t("profile.usernameTaken")
          : status === "invalid"
            ? t("profile.usernameInvalid", { min: USERNAME_MIN, max: USERNAME_MAX })
            : status === "unchanged"
              ? t("profile.usernameUnchanged")
              : t("profile.usernameHint", { max: USERNAME_MAX });

  const hintClass =
    isValid
      ? "text-emerald-600 dark:text-emerald-400"
      : isInvalid
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor="account-username">{t("profile.username")}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
          @
        </span>
        <Input
          id="account-username"
          value={value}
          disabled={disabled}
          valid={isValid}
          autoComplete="username"
          spellCheck={false}
          className="ps-8 pe-10 font-mono"
          aria-invalid={isInvalid}
          aria-describedby="account-username-hint"
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))}
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
          {status === "checking" ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          {isValid ? <Check className="size-4 text-emerald-500" aria-hidden /> : null}
          {isInvalid ? <X className="size-4 text-red-500" aria-hidden /> : null}
        </span>
      </div>
      <p id="account-username-hint" className={cn("text-xs", hintClass)}>
        {hint}
      </p>
    </div>
  );
}
