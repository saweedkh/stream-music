import type { APIRequestContext, Page } from "@playwright/test";

import { apiURL, fetchCsrf } from "./auth";

export async function seedE2EPremiumCode(request: APIRequestContext): Promise<string> {
  const csrf = await fetchCsrf(request);
  const res = await request.post(`${apiURL}/api/e2e/premium-code`, {
    headers: { "X-CSRFToken": csrf },
  });
  if (!res.ok()) {
    throw new Error(
      `e2e premium-code failed: ${res.status()} — ensure backend has E2E_RATE_LIMIT_OFF=1`,
    );
  }
  const body = (await res.json()) as { code?: string };
  if (!body.code) throw new Error("e2e premium-code missing code");
  return body.code;
}

export async function openDashboardSettingsOverview(page: Page): Promise<void> {
  await page.goto("/dashboard?tab=settings&section=overview");
  await page.getByTestId("premium-redeem-card").waitFor({ state: "visible", timeout: 30_000 });
}

export async function openChannelInsightsTab(page: Page, channelId: number | string): Promise<void> {
  await page.goto(`/channel/${channelId}?tab=insights`);
}
