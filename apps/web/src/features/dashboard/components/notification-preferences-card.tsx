"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import {
  deleteWebPushSubscriptions,
  getMe,
  patchNotificationSettings,
  sendPushTest,
  type UserNotificationSettings,
} from "@/lib/api";
import { useNotificationStore } from "@/lib/notifications/store";
import {
  getDevCertInstallUrl,
  getDevHttpsSiteUrl,
  hasActivePushSubscription,
  isPushEnvironmentSupported,
  needsDevCertTrustOnThisDevice,
  pushEnvironmentIssue,
  registerWebPushOnDevice,
  resolveVapidPublicKey,
} from "@/lib/webpush-client";

const DEFAULT_SETTINGS: UserNotificationSettings = {
  chat_notify: "all",
  admin_notify_reactions: true,
  admin_notify_votes: true,
  push_category_playback: true,
  push_category_chat: true,
  push_category_moderation: true,
  updated_at: "",
};

export function NotificationPreferencesCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const setNotificationPrefs = useNotificationStore((s) => s.setPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [settings, setSettings] = useState<UserNotificationSettings>(DEFAULT_SETTINGS);
  const [vapidPublic, setVapidPublic] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [envIssue, setEnvIssue] = useState<string | null>(null);
  const [showCertHelp, setShowCertHelp] = useState(false);
  const certInstallUrl = typeof window !== "undefined" ? getDevCertInstallUrl() : null;
  const httpsSiteUrl = typeof window !== "undefined" ? getDevHttpsSiteUrl() : null;

  const refreshPushState = useCallback(async () => {
    setEnvIssue(pushEnvironmentIssue());
    const active = await hasActivePushSubscription();
    setPushEnabled(active);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      if (!me?.user) {
        setSettings(DEFAULT_SETTINGS);
        setVapidPublic(null);
        return;
      }
      setSettings(me.notification_settings ?? DEFAULT_SETTINGS);
      const key = me.webpush?.vapid_public_key?.trim() || (await resolveVapidPublicKey());
      setVapidPublic(key || null);
      await refreshPushState();
    } catch {
      showToast(t("settings.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [refreshPushState, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistPatch = async (partial: Partial<UserNotificationSettings>) => {
    setSaving(true);
    try {
      const next = await patchNotificationSettings(partial);
      setSettings(next);
      setNotificationPrefs(next);
      showToast(t("settings.saved"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("settings.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  async function enablePush() {
    if (!vapidPublic) {
      showToast(t("settings.noVapid"), "error");
      return;
    }
    setPushBusy(true);
    try {
      const result = await registerWebPushOnDevice({ requestPermission: true });
      if (result.status === "ok") {
        setPushEnabled(true);
        showToast(t("settings.pushEnabled"), "success");
        return;
      }
      if (result.status === "insecure") {
        showToast(result.reason, "error");
        return;
      }
      if (result.status === "unsupported") {
        showToast(result.reason, "error");
        return;
      }
      if (result.status === "no_key") {
        showToast("VAPID public key missing on server.", "error");
        return;
      }
      if (result.status === "denied") {
        showToast(t("settings.allowNotifications"), "error");
        return;
      }
      if (result.status === "ssl_untrusted") {
        setShowCertHelp(true);
        showToast(t("settings.installCert"), "error");
        return;
      }
      showToast(result.message || "Could not enable push.", "error");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      await sub?.unsubscribe();
      await deleteWebPushSubscriptions(endpoint);
      setPushEnabled(false);
      showToast(t("settings.pushDisabled"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not disable push.", "error");
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border/90 bg-card/40">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("common.loading")}
        </CardContent>
      </Card>
    );
  }

  const canUsePush = isPushEnvironmentSupported() && Boolean(vapidPublic);

  return (
    <Card className="w-full border-border/40 bg-[var(--surface-inset)]">
      <CardHeader className="sr-only">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Bell className="size-5 text-brand/90" aria-hidden />
          {t("settings.cardTitle")}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t("settings.cardDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {envIssue ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
            {envIssue}
          </p>
        ) : null}

        {(showCertHelp || needsDevCertTrustOnThisDevice()) && certInstallUrl ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-950/35 px-3 py-3 text-xs leading-relaxed text-amber-50/95">
            <p className="font-medium text-amber-100">Trust dev HTTPS on this phone (required for push)</p>
            <ol className="list-decimal space-y-2 ps-4 text-amber-100/90">
              <li>
                <a
                  href={certInstallUrl}
                  className="font-medium text-brand underline underline-offset-2"
                >
                  Download CA certificate
                </a>{" "}
                ({certInstallUrl})
              </li>
              <li>
                <strong>iPhone:</strong> Install profile → Settings → General → About →{" "}
                <strong>Certificate Trust Settings</strong> → enable <em>Beat Room Dev CA</em>.
              </li>
              <li>
                <strong>Android:</strong> Settings → Security → Install certificate → CA certificate.
              </li>
              <li>
                Force-quit the browser, reopen{" "}
                {httpsSiteUrl ? (
                  <a href={httpsSiteUrl} className="text-brand underline">
                    {httpsSiteUrl}
                  </a>
                ) : (
                  "this HTTPS site"
                )}
                , then tap <strong>Enable push</strong> again.
              </li>
            </ol>
          </div>
        ) : null}

        {pushEnabled ? (
          <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-[var(--brand-subtle)] px-3 py-2 text-sm text-brand">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Push is active on this browser. Chat and moderator alerts will be delivered here when enabled below.
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-foreground">Channel chat (this browser)</Label>
          <Select
            value={settings.chat_notify}
            disabled={saving}
            className="border-border bg-card/80"
            onChange={(e) =>
              void persistPatch({ chat_notify: e.target.value as UserNotificationSettings["chat_notify"] })
            }
          >
            <option value="muted">Muted — no chat push</option>
            <option value="mentions">Mentions only (@you, @everyone, @all)</option>
            <option value="all">All messages in channels you joined</option>
          </Select>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">When you moderate a channel</p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="adm-react" className="text-sm text-muted-foreground">
              Reactions
            </Label>
            <Switch
              id="adm-react"
              checked={settings.admin_notify_reactions}
              disabled={saving}
              onCheckedChange={(on) => void persistPatch({ admin_notify_reactions: on })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="adm-vote" className="text-sm text-muted-foreground">
              Skip votes
            </Label>
            <Switch
              id="adm-vote"
              checked={settings.admin_notify_votes}
              disabled={saving}
              onCheckedChange={(on) => void persistPatch({ admin_notify_votes: on })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Quiet hours start (0–23, optional)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              placeholder="e.g. 23"
              className="border-border bg-card/80"
              value={settings.push_quiet_hours_start ?? ""}
              onChange={(e) =>
                void persistPatch({
                  push_quiet_hours_start: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Quiet hours end (0–23)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              placeholder="e.g. 7"
              className="border-border bg-card/80"
              value={settings.push_quiet_hours_end ?? ""}
              onChange={(e) =>
                void persistPatch({
                  push_quiet_hours_end: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">Push categories</p>
          {(
            [
              ["push_category_chat", "Chat"],
              ["push_category_playback", "Playback / room live"],
              ["push_category_moderation", "Moderation (reactions, votes)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label className="text-sm text-muted-foreground">{label}</Label>
              <Switch
                checked={Boolean(settings[key])}
                disabled={saving}
                onCheckedChange={(on) => void persistPatch({ [key]: on })}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={pushBusy || !canUsePush || pushEnabled}
            onClick={() => void enablePush()}
          >
            {pushBusy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Enable push on this device
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-border"
            disabled={pushBusy || !pushEnabled}
            onClick={() => void disablePush()}
          >
            <BellOff className="size-4" />
            Clear push for this device
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pushBusy || !pushEnabled}
            onClick={async () => {
              setPushBusy(true);
              try {
                await sendPushTest();
                showToast(t("settings.testSent"), "success");
              } catch (e) {
                showToast(e instanceof Error ? e.message : t("settings.testFailed"), "error");
              } finally {
                setPushBusy(false);
              }
            }}
          >
            Send test push
          </Button>
        </div>

        {!vapidPublic ? (
          <p className="text-xs text-amber-300/90">
            Backend has no VAPID keys. Set WEBPUSH_VAPID_PUBLIC_KEY / WEBPUSH_VAPID_PRIVATE_KEY and restart:{" "}
            <code className="text-warning/80">docker compose restart backend</code>
          </p>
        ) : !canUsePush && !envIssue ? (
          <p className="text-xs text-muted-foreground">Waiting for a secure browser context…</p>
        ) : saving ? (
          <p className="text-xs text-muted-foreground">Saving preferences…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
