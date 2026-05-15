"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast-provider";
import {
  deleteWebPushSubscriptions,
  getMe,
  patchNotificationSettings,
  type UserNotificationSettings,
} from "@/lib/api";
import { registerWebPushOnDevice, resolveVapidPublicKey } from "@/lib/webpush-client";

export function NotificationPreferencesCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [vapidPublic, setVapidPublic] = useState<string | null>(null);
  const [pushEnv, setPushEnv] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      if (!me?.user) {
        setSettings(null);
        setVapidPublic(null);
        return;
      }
      setSettings(me.notification_settings ?? null);
      setVapidPublic((await resolveVapidPublicKey()) || me.webpush?.vapid_public_key?.trim() || null);
      setPushEnv(typeof window !== "undefined" ? process.env.NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY?.trim() || null : null);
    } catch {
      showToast("Could not load notification settings.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistPatch = async (partial: Partial<UserNotificationSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await patchNotificationSettings(partial);
      setSettings(next);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  async function enablePush() {
    const key = (pushEnv || vapidPublic || (await resolveVapidPublicKey()) || "").trim();
    if (!key) {
      showToast("VAPID public key is not configured on the server.", "error");
      return;
    }
    setPushBusy(true);
    try {
      const result = await registerWebPushOnDevice({ requestPermission: true });
      if (result === "ok") {
        showToast("Browser notifications enabled for this device.", "success");
        return;
      }
      const messages: Record<string, string> = {
        unsupported: "Push notifications are not supported in this browser.",
        no_key: "VAPID public key is not configured on the server.",
        denied: "Notification permission was not granted.",
        error: "Could not enable push.",
      };
      showToast(messages[result] ?? "Could not enable push.", "error");
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
      showToast("Push disabled for this device on the server.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not disable push.", "error");
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-zinc-800/90 bg-zinc-950/40">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-zinc-400">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading notification settings…
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const chatKey = (pushEnv || vapidPublic || "").trim();

  return (
    <Card className="border-zinc-800/90 bg-zinc-950/40">
      <CardHeader className="border-b border-zinc-800/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
          <Bell className="size-5 text-emerald-400/90" aria-hidden />
          Notifications
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Choose how channel chat reaches you, and whether moderators get alerts for reactions and skip votes. Tapping a
          notification opens that channel with the chat tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label className="text-zinc-200">Channel chat (this browser)</Label>
          <Select
            value={settings.chat_notify}
            disabled={saving}
            className="border-zinc-800 bg-zinc-900/80"
            onChange={(e) =>
              void persistPatch({ chat_notify: e.target.value as UserNotificationSettings["chat_notify"] })
            }
          >
            <option value="muted">Muted — no chat push</option>
            <option value="mentions">Mentions only (@you, @everyone, @all)</option>
            <option value="all">All messages in channels you joined</option>
          </Select>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium text-zinc-200">When you moderate a channel</p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="adm-react" className="text-sm text-zinc-400">
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
            <Label htmlFor="adm-vote" className="text-sm text-zinc-400">
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-2" disabled={pushBusy || !chatKey} onClick={() => void enablePush()}>
            {pushBusy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Enable push on this device
          </Button>
          <Button type="button" variant="outline" className="gap-2 border-zinc-700" disabled={pushBusy} onClick={() => void disablePush()}>
            <BellOff className="size-4" />
            Clear push for this device
          </Button>
        </div>
        {!chatKey ? (
          <p className="text-xs text-amber-300/90">
            Restart the backend after setting WEBPUSH_VAPID_* in env, then reload this page.
          </p>
        ) : (
          <p className="text-xs text-zinc-600">{saving ? "Saving…" : null}</p>
        )}
      </CardContent>
    </Card>
  );
}
