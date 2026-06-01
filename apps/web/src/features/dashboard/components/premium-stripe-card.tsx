"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { createPremiumCheckout } from "@/lib/api/accounts-premium";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function PremiumStripeCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onCheckout() {
    setBusy(true);
    try {
      const { checkout_url } = await createPremiumCheckout();
      window.location.href = checkout_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("premium.stripeFailed");
      if (msg.includes("stripe_not_configured") || msg.includes("503")) {
        showToast(t("premium.stripeNotConfigured"), "info");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/90" data-testid="premium-stripe-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-brand" />
          {t("premium.stripeTitle")}
        </CardTitle>
        <CardDescription>{t("premium.stripeHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" disabled={busy} onClick={() => void onCheckout()} data-testid="premium-stripe-checkout">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("premium.stripeAction")}
        </Button>
      </CardContent>
    </Card>
  );
}
