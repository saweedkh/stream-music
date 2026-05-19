import type { APIRequestContext, Page } from "@playwright/test";

export const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";

export function uniqueUsername(prefix = "e2e"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchCsrf(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${apiURL}/api/auth/csrf`);
  if (!res.ok()) throw new Error(`csrf failed: ${res.status()}`);
  const state = await request.storageState();
  const token = state.cookies.find((c) => c.name === "csrftoken")?.value;
  if (!token) throw new Error("csrftoken cookie missing");
  return token;
}

export async function registerAndLogin(
  request: APIRequestContext,
  username: string,
  password = "pw12345678",
): Promise<void> {
  let csrf = await fetchCsrf(request);
  const register = await request.post(`${apiURL}/api/auth/register`, {
    data: { username, email: `${username}@example.com`, password },
    headers: { "X-CSRFToken": csrf },
  });
  if (!register.ok() && register.status() !== 400) {
    throw new Error(`register failed: ${register.status()} ${await register.text()}`);
  }

  csrf = await fetchCsrf(request);
  const login = await request.post(`${apiURL}/api/auth/login`, {
    data: { username, password },
    headers: { "X-CSRFToken": csrf },
  });
  if (!login.ok()) throw new Error(`login failed: ${login.status()} ${await login.text()}`);

  const me = await request.get(`${apiURL}/api/auth/me`);
  if (!me.ok()) throw new Error(`me failed after login: ${me.status()}`);
}

export async function loginInBrowser(page: Page, username: string, password = "pw12345678"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/(dashboard|channel)/, { timeout: 30_000 });
}
