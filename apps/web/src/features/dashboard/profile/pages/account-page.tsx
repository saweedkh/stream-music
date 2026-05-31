"use client";

import { Save } from "lucide-react";
import { useProfilePageContext } from "@/features/dashboard/profile/context/profile-page-context";
import { ProfileFormFooter } from "@/features/dashboard/profile/ui/profile-form-footer";
import { ProfileSubmitButton } from "@/features/dashboard/profile/ui/profile-submit-button";
import { ProfileHero } from "@/features/dashboard/profile/ui/profile-hero";
import { ProfilePublicToggle } from "@/features/dashboard/profile/ui/profile-public-toggle";
import { ProfileTextarea } from "@/features/dashboard/profile/ui/profile-textarea";
import { ProfileUsernameField } from "@/features/dashboard/profile/ui/profile-username-field";
import { WorkspacePage, WorkspaceSection } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

const BIO_MAX = 500;

type AccountPageProps = {
  channelCount: number;
  trackCount: number;
  playlistCount: number;
};

export function AccountPage({ channelCount, trackCount, playlistCount }: AccountPageProps) {
  const { t } = useTranslations();
  const { user, displayName, memberSinceLabel, avatarBusy, uploadAvatar, removeAvatar, account } =
    useProfilePageContext();

  if (!user) return null;

  const previewUsername = account.username.trim() || user.username;

  return (
    <WorkspacePage>
      <ProfileHero
        user={user}
        displayName={displayName}
        memberSinceLabel={memberSinceLabel}
        channelCount={channelCount}
        trackCount={trackCount}
        playlistCount={playlistCount}
        avatarBusy={avatarBusy}
        onAvatarUpload={uploadAvatar}
        onAvatarRemove={removeAvatar}
      />

      <form className="flex flex-col gap-6" onSubmit={(e) => void account.save(e)}>
        <WorkspaceSection title={t("profile.accountIdentity")} description={t("profile.accountIdentityHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileUsernameField
              value={account.username}
              status={account.usernameStatus}
              disabled={account.saving}
              onChange={account.setUsername}
            />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="account-email">{t("profile.email")}</Label>
              <Input
                id="account-email"
                type="email"
                autoComplete="email"
                value={account.email}
                onChange={(e) => account.setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-first">{t("profile.firstName")}</Label>
              <Input
                id="account-first"
                autoComplete="given-name"
                value={account.firstName}
                onChange={(e) => account.setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-last">{t("profile.lastName")}</Label>
              <Input
                id="account-last"
                autoComplete="family-name"
                value={account.lastName}
                onChange={(e) => account.setLastName(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="account-bio">{t("profile.public.bio")}</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {t("profile.bioCharCount", { count: account.bio.length })}
                </span>
              </div>
              <ProfileTextarea
                id="account-bio"
                value={account.bio}
                maxLength={BIO_MAX}
                rows={4}
                placeholder={t("profile.bioPlaceholder")}
                onChange={(e) => account.setBio(e.target.value)}
              />
            </div>

            <ProfilePublicToggle
              username={previewUsername}
              isPublic={account.isPublic}
              disabled={account.saving}
              onIsPublicChange={account.setIsPublic}
            />
          </div>
        </WorkspaceSection>

        <ProfileFormFooter
          status={
            <span className={cn(account.dirty && "text-amber-600 dark:text-amber-400")}>
              {account.dirty ? t("profile.unsavedChanges") : t("profile.allChangesSaved")}
            </span>
          }
          actions={
            <ProfileSubmitButton
              loading={account.saving}
              disabled={!account.canSave}
              icon={<Save className="size-4" aria-hidden />}
            >
              {t("profile.saveProfile")}
            </ProfileSubmitButton>
          }
        />
      </form>
    </WorkspacePage>
  );
}
