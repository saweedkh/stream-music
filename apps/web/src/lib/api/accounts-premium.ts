import { getApiBase, withAuthHeaders, extractApiError } from "./client";

export async function createPremiumCheckout(): Promise<{ checkout_url: string; session_id: string }> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(
    `${getApiBase()}/api/auth/me/premium/checkout`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({
        success_url: `${base}/dashboard?tab=settings&section=overview&premium=success`,
        cancel_url: `${base}/dashboard?tab=settings&section=overview&premium=cancel`,
      }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot start checkout"));
  return (await res.json()) as { checkout_url: string; session_id: string };
}
