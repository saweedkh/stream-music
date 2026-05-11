/* global self, clients */
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
  event.waitUntil(self.registration.showNotification(title, { body, tag, data: { url }, icon: "/favicon.ico" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
