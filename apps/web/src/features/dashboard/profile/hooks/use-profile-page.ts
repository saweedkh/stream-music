"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { useUsernameAvailability } from "@/features/dashboard/profile/hooks/use-username-availability";
import { formatMemberSince } from "@/features/dashboard/profile/model/format-member-since";
import { normalizeUsername } from "@/features/dashboard/profile/model/username";
import {
  clearMeAvatar,
  getMe,
  patchMeProfile,
  patchMePublicProfile,
  postChangePassword,
  uploadMeAvatar,
  type AuthUser,
} from "@/lib/api";
import { localizeMessage } from "@/lib/i18n/localize-message";
import { dispatchUserSessionRefresh } from "@/lib/user-session-events";

const PASSWORD_MIN = 8;

export function useProfilePage() {
  const { t, locale } = useTranslations();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      const u = me?.user ?? null;
      setUser(u);
      if (u) {
        setUsername(u.username ?? "");
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

  const usernameCheck = useUsernameAvailability(user?.username ?? "", username);

  const accountDirty = useMemo(() => {
    if (!user) return false;
    return (
      normalizeUsername(username) !== normalizeUsername(user.username ?? "") ||
      email.trim() !== (user.email ?? "").trim() ||
      firstName.trim() !== (user.first_name ?? "").trim() ||
      lastName.trim() !== (user.last_name ?? "").trim() ||
      bio.trim() !== (user.bio ?? "").trim() ||
      isPublic !== Boolean(user.is_public)
    );
  }, [bio, email, firstName, isPublic, lastName, user, username]);

  const accountCanSave = accountDirty && usernameCheck.canUseUsername;

  const passwordReady = useMemo(
    () =>
      currentPassword.length > 0 &&
      newPassword.length >= PASSWORD_MIN &&
      newPassword === confirmPassword &&
      confirmPassword.length > 0,
    [confirmPassword, currentPassword, newPassword],
  );

  const saveAccount = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !accountCanSave) return;
      setSavingAccount(true);
      try {
        const nextUsername = normalizeUsername(username);
        const [me, publicProfile] = await Promise.all([
          patchMeProfile({
            username: nextUsername !== normalizeUsername(user.username) ? nextUsername : undefined,
            email: email.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          }),
          patchMePublicProfile({ bio: bio.trim(), is_public: isPublic }),
        ]);
        setUser({
          ...me.user,
          bio: bio.trim(),
          is_public: isPublic,
          avatar_url: publicProfile.avatar_url ?? me.user.avatar_url ?? null,
        });
        setUsername(me.user.username);
        showToast(t("profile.profileSaved"), "success");
        dispatchUserSessionRefresh();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        showToast(raw ? localizeMessage(raw, locale) : t("profile.loadFailed"), "error");
      } finally {
        setSavingAccount(false);
      }
    },
    [accountCanSave, bio, email, firstName, isPublic, lastName, locale, showToast, t, user, username],
  );

  const applyPublicProfile = useCallback((payload: { bio: string; is_public: boolean; avatar_url: string | null }) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            bio: payload.bio,
            is_public: payload.is_public,
            avatar_url: payload.avatar_url,
          }
        : prev,
    );
    setBio(payload.bio);
    setIsPublic(payload.is_public);
  }, []);

  const uploadAvatar = useCallback(
    async (file: File) => {
      setAvatarBusy(true);
      try {
        const payload = await uploadMeAvatar(file);
        applyPublicProfile(payload);
        const me = await getMe();
        if (me?.user) {
          setUser((prev) => (prev ? { ...prev, ...me.user, avatar_url: me.user.avatar_url ?? payload.avatar_url } : me.user));
        }
        showToast(t("profile.avatar.uploaded"), "success");
        dispatchUserSessionRefresh();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        showToast(raw ? localizeMessage(raw, locale) : t("profile.loadFailed"), "error");
      } finally {
        setAvatarBusy(false);
      }
    },
    [applyPublicProfile, locale, showToast, t],
  );

  const removeAvatar = useCallback(async () => {
    setAvatarBusy(true);
    try {
      const payload = await clearMeAvatar();
      applyPublicProfile(payload);
      showToast(t("profile.avatar.removed"), "success");
      dispatchUserSessionRefresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      showToast(raw ? localizeMessage(raw, locale) : t("profile.loadFailed"), "error");
    } finally {
      setAvatarBusy(false);
    }
  }, [applyPublicProfile, locale, showToast, t]);

  const changePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < PASSWORD_MIN) {
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
        const raw = err instanceof Error ? err.message : "";
        showToast(raw ? localizeMessage(raw, locale) : t("profile.loadFailed"), "error");
      } finally {
        setSavingPassword(false);
      }
    },
    [confirmPassword, currentPassword, locale, newPassword, showToast, t],
  );

  return {
    loading,
    user,
    displayName,
    memberSinceLabel,
    avatarBusy,
    uploadAvatar,
    removeAvatar,
    account: {
      username,
      setUsername,
      usernameStatus: usernameCheck.status,
      canSave: accountCanSave,
      email,
      setEmail,
      firstName,
      setFirstName,
      lastName,
      setLastName,
      bio,
      setBio,
      isPublic,
      setIsPublic,
      dirty: accountDirty,
      saving: savingAccount,
      save: saveAccount,
    },
    password: {
      current: currentPassword,
      setCurrent: setCurrentPassword,
      next: newPassword,
      setNext: setNewPassword,
      confirm: confirmPassword,
      setConfirm: setConfirmPassword,
      ready: passwordReady,
      saving: savingPassword,
      change: changePassword,
    },
  };
}

export type ProfilePageState = ReturnType<typeof useProfilePage>;
