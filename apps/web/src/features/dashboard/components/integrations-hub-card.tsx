"use client";

import { useState } from "react";
import { Webhook } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { createApiToken, createWebhook } from "@/lib/api/integrations";
import { getMyReferral } from "@/lib/api/discovery";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export function IntegrationsHubCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [referral, setReferral] = useState<string | null>(null);

  async function loadReferral() {
    try {
      const r = await getMyReferral();
      setReferral(r.code);
    } catch {
      setReferral(null);
    }
  }

  async function onWebhook() {
    if (!webhookUrl.trim()) return;
    try {
      const r = await createWebhook(webhookUrl.trim(), ["channel.live", "channel.shuffle"]);
      showToast(t("integrations.webhookCreated"), "success");
      void navigator.clipboard?.writeText(r.secret);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("integrations.failed"), "error");
    }
  }

  async function onToken() {
    try {
      const r = await createApiToken("homelab");
      showToast(t("integrations.tokenCreated"), "success");
      void navigator.clipboard?.writeText(r.token);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("integrations.failed"), "error");
    }
  }

  return (
    <Card data-testid="integrations-hub">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-4 w-4" />
          {t("integrations.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={t("integrations.webhookPlaceholder")}
          />
          <Button type="button" onClick={() => void onWebhook()}>
            {t("integrations.addWebhook")}
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={() => void onToken()}>
          {t("integrations.createToken")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void loadReferral()}>
          {t("integrations.showReferral")}
        </Button>
        {referral ? (
          <p className="text-muted-foreground">
            {t("integrations.referralCode")}: <code className="text-foreground">{referral}</code>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
