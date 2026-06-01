import { extractApiError, getApiBase, withAuthHeaders } from "@/lib/api/client";

export async function listWebhooks(): Promise<{
  results: {
    id: number;
    url: string;
    events: string[];
    is_active: boolean;
    last_delivery_at: string | null;
    last_error: string;
  }[];
}> {
  const res = await fetch(`${getApiBase()}/api/me/webhooks`, await withAuthHeaders());
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load webhooks"));
  return (await res.json()) as {
    results: {
      id: number;
      url: string;
      events: string[];
      is_active: boolean;
      last_delivery_at: string | null;
      last_error: string;
    }[];
  };
}

export async function createWebhook(url: string, events: string[]): Promise<{ id: number; secret: string }> {
  const res = await fetch(
    `${getApiBase()}/api/me/webhooks`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ url, events }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create webhook"));
  return (await res.json()) as { id: number; secret: string };
}

export async function createApiToken(name: string): Promise<{ token: string; prefix: string }> {
  const res = await fetch(
    `${getApiBase()}/api/me/api-tokens`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ name }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create token"));
  return (await res.json()) as { token: string; prefix: string };
}
