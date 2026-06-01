"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { redeemPremiumCode } from "@/lib/api/analytics";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export function PremiumRedeemCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onRedeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await redeemPremiumCode(code.trim());
      showToast(t("premium.redeemSuccess"), "success");
      setCode("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("premium.redeemFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/90" data-testid="premium-redeem-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-brand" />
          {t("premium.redeemTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("premium.redeemPlaceholder")}
          className="flex-1"
          data-testid="premium-redeem-input"
        />
        <Button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => void onRedeem()}
          data-testid="premium-redeem-submit"
        >
          {t("premium.redeemAction")}
        </Button>
      </CardContent>
    </Card>
  );
}
