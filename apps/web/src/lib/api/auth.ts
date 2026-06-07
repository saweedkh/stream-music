import { getApiBase, withAuthHeaders, extractApiError } from "./client";
import type { AuthUser, MeBootstrap, UserNotificationSettings } from "./types";

export async function loginUser(username: string, password: string) {
  const res = await fetch(`${getApiBase()}/api/auth/login`, await withAuthHeaders({ method: "POST", body: JSON.stringify({ username, password }) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Login failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  referralCode?: string,
) {
  const body: Record<string, string> = { username, email, password };
  if (referralCode?.trim()) body.referral_code = referralCode.trim();
  const res = await fetch(
    `${getApiBase()}/api/auth/register`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(body) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Register failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function logoutUser() {
  const res = await fetch(`${getApiBase()}/api/auth/logout`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Logout failed"));
}

export async function getMe(): Promise<MeBootstrap | null> {
  const res = await fetch(`${getApiBase()}/api/auth/me`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as MeBootstrap;
}

export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; reason?: string }> {
  const q = new URLSearchParams({ username: username.trim() });
  const res = await fetch(
    `${getApiBase()}/api/auth/username-available?${q}`,
    await withAuthHeaders({ method: "GET" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot check username"));
  return (await res.json()) as { available: boolean; reason?: string };
}

export async function patchMeProfile(payload: {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}): Promise<MeBootstrap> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update profile"));
  return (await res.json()) as MeBootstrap;
}

export async function postChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/password`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot change password"));
}

export async function checkApiHealth(): Promise<{ status: string; db: boolean; redis: boolean }> {
  const res = await fetch(`${getApiBase()}/api/health`, { cache: "no-store" });
  const data = (await res.json()) as { status: string; db: boolean; redis: boolean };
  return data;
}

export async function sendPushTest(): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/auth/me/push-test`, await withAuthHeaders({ method: "POST", body: "{}" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Push test failed"));
}

export async function patchNotificationSettings(payload: Partial<UserNotificationSettings>): Promise<UserNotificationSettings> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/notification-settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot save notification settings"));
  return (await res.json()) as UserNotificationSettings;
}

export async function registerWebPushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/push-subscription`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(subscription) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot register push subscription"));
}

export async function deleteWebPushSubscriptions(endpoint?: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/push-subscription`,
    await withAuthHeaders({
      method: "DELETE",
      body: endpoint ? JSON.stringify({ endpoint }) : JSON.stringify({}),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove push subscription"));
}

export async function listUsers() {
  const res = await fetch(`${getApiBase()}/api/auth/users`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load users");
  return (await res.json()) as { results: Array<{ id: number; username: string; avatar_url?: string | null }> };
}

export async function getServerTime() {
  const t0 = Date.now();
  const res = await fetch(`${getApiBase()}/api/time`, { cache: "no-store" });
  const t1 = Date.now();
  const body = await res.json();
  const latency = (t1 - t0) / 2;
  const offset = body.time * 1000 - (t0 + latency);
  return { serverTime: body.time, offset };
}

export async function getApiMetrics() {
  const res = await fetch(`${getApiBase()}/api/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load metrics");
  return (await res.json()) as {
    server_time: number;
    channels_active: number;
    channels_playing: number;
    memberships_active: number;
    tracks_total: number;
    users_active: number;
  };
}
