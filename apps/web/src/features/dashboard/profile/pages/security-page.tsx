"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useProfilePageContext } from "@/features/dashboard/profile/context/profile-page-context";
import { ProfileFormFooter } from "@/features/dashboard/profile/ui/profile-form-footer";
import { ProfileSubmitButton } from "@/features/dashboard/profile/ui/profile-submit-button";
import { WorkspaceNotice, WorkspacePage, WorkspaceSection } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslations();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          className="pe-10"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function SecurityPage() {
  const { t } = useTranslations();
  const { password } = useProfilePageContext();

  return (
    <WorkspacePage className="max-w-2xl">
      <WorkspaceNotice>{t("profile.passwordHint")}</WorkspaceNotice>

      <form className="flex flex-col gap-6" onSubmit={(e) => void password.change(e)}>
        <WorkspaceSection title={t("profile.securityFormTitle")} description={t("profile.securityFormDescription")}>
          <div className="flex flex-col gap-4">
            <PasswordField
              id="security-current"
              label={t("profile.currentPassword")}
              value={password.current}
              autoComplete="current-password"
              disabled={password.saving}
              onChange={password.setCurrent}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="security-new"
                label={t("profile.newPassword")}
                value={password.next}
                autoComplete="new-password"
                disabled={password.saving}
                onChange={password.setNext}
              />
              <PasswordField
                id="security-confirm"
                label={t("profile.confirmPassword")}
                value={password.confirm}
                autoComplete="new-password"
                disabled={password.saving}
                onChange={password.setConfirm}
              />
            </div>
          </div>
        </WorkspaceSection>

        <ProfileFormFooter
          actions={
            <ProfileSubmitButton loading={password.saving} disabled={!password.ready}>
              {t("profile.changePassword")}
            </ProfileSubmitButton>
          }
        />
      </form>
    </WorkspacePage>
  );
}
