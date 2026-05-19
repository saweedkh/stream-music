import type { Page } from "@playwright/test";

/** Dismiss first-visit room onboarding so the player is reachable. */
export async function dismissRoomOnboarding(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: /listen together|با هم گوش/i });
  if (!(await dialog.isVisible().catch(() => false))) return;

  const skip = page.getByRole("button", { name: /^skip$|^رد کردن$/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    return;
  }

  const close = page.getByRole("button", { name: /^close$|^بستن$/i });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    return;
  }

  for (let i = 0; i < 3; i += 1) {
    const next = page.getByRole("button", { name: /^next$|^بعدی$/i });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
}

export async function waitForPlayerShell(page: Page): Promise<void> {
  const shell = page.getByTestId("channel-player-shell").or(page.locator(".player-shell").first());
  await shell.waitFor({ state: "visible", timeout: 60_000 });
}
