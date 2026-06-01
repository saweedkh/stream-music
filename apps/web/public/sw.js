/* global self, clients, caches */
const SHELL_CACHE = "sm-shell-v1";
const SHELL_URLS = ["/", "/dashboard", "/explore", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!event.request.mode || event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || caches.match("/")),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title.trim() ? data.title : "Stream Music";
  const body = typeof data.body === "string" ? data.body : "";
  const url = typeof data.url === "string" && data.url.trim() ? data.url : "/";
  const tag = typeof data.tag === "string" && data.tag.trim() ? data.tag : "stream-music";
  const category = typeof data.category === "string" ? data.category : "system";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url, category },
      icon: "/favicon.ico",
    }),
  );
});

function targetKey(rawUrl) {
  try {
    const u = new URL(rawUrl, self.location.origin);
    return u.pathname + u.search;
  } catch {
    return rawUrl;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  const key = targetKey(url);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (targetKey(client.url) === key && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          if (typeof client.navigate === "function") {
            return client.navigate(url);
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
