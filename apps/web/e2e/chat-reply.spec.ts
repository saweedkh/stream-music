import { test, expect } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { chatReplyRoundTrip } from "./helpers/chat-ws";
import { dismissRoomOnboarding } from "./helpers/room";
import { createChannel } from "./helpers/social";

test.describe("channel chat reply", () => {
  test.describe.configure({ mode: "serial" });

  test("send message and reply shows thread preview", async ({ browser, request, baseURL }) => {
    test.setTimeout(120_000);
    const username = uniqueUsername("chat");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);

    const channel = await createChannel(request, {
      name: `ChatReply ${Date.now()}`,
      description: "e2e chat",
      privacy: "public",
    });

    const storage = await request.storageState();
    const context = await browser.newContext({ storageState: storage, baseURL });
    const page = await context.newPage();

    await page.goto(`/channel/${channel.id}?tab=chat`, { waitUntil: "domcontentloaded" });
    await dismissRoomOnboarding(page);

    const compose = page.getByTestId("channel-chat-compose");
    await expect(compose).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("channel-chat-connected")).toBeVisible({ timeout: 60_000 });

    const sendBtn = page.getByTestId("channel-chat-send");

    const parentText = `E2E parent ${Date.now()}`;
    await compose.fill(parentText);
    await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
    await sendBtn.click();
    await expect(page.getByText(parentText)).toBeVisible({ timeout: 20_000 });

    const msgContainer = page.locator("[id^='chat-msg-']").filter({ hasText: parentText }).first();
    await msgContainer.getByRole("button", { name: /message actions|عملیات پیام/i }).click();
    await msgContainer.getByTestId("chat-reply-btn").click();

    await expect(page.getByText(new RegExp(`replying to @${username}`, "i"))).toBeVisible();

    const replyText = `E2E reply ${Date.now()}`;
    await compose.fill(replyText);
    await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
    await sendBtn.click();

    await expect(page.getByText(replyText)).toBeVisible({ timeout: 20_000 });

    const replyBubble = page.locator("[id^='chat-msg-']").filter({ hasText: replyText }).first();
    await expect(replyBubble.getByText(parentText).first()).toBeVisible();

    await context.close();
  });

  test("API: reply over WebSocket includes reply_preview", async ({ request }) => {
    const username = uniqueUsername("ws");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);
    const channel = await createChannel(request, {
      name: `ChatWS ${Date.now()}`,
      privacy: "public",
    });
    await request.post(`${apiURL}/api/channels/${channel.id}/join`, {
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });

    const parentText = `WS parent ${Date.now()}`;
    const replyText = `WS reply ${Date.now()}`;
    const { reply } = await chatReplyRoundTrip(request, channel.id, parentText, replyText);

    expect(reply.body).toBe(replyText);
    expect(reply.reply_preview?.body).toContain(parentText);
  });

  test("API: chat history endpoint returns array for member", async ({ request }) => {
    const username = uniqueUsername("chapi");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);
    const channel = await createChannel(request, {
      name: `ChatHist ${Date.now()}`,
      privacy: "public",
    });

    const hist = await request.get(`${apiURL}/api/channels/${channel.id}/chat`);
    expect(hist.ok()).toBeTruthy();
    const body = (await hist.json()) as { results: unknown[] };
    expect(Array.isArray(body.results)).toBeTruthy();
  });
});
