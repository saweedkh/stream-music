import type { Page } from "@playwright/test";

/** Dismiss first-visit room onboarding so tabs/chat controls are reachable. */
export async function dismissRoomOnboarding(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: /listen together|با هم گوش/i });
  try {
    await dialog.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    return;
  }

  const skip = page.getByRole("button", { name: /^skip$|^رد کردن$/i });
  await skip.click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
}

export async function waitForPlayerShell(page: Page): Promise<void> {
  const shell = page.getByTestId("channel-player-shell").or(page.locator(".player-shell").first());
  await shell.waitFor({ state: "visible", timeout: 60_000 });
}
