self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  event.waitUntil(self.registration.showNotification(payload.title || "LiveFoot", {
    body: payload.body || "Une nouveauté vous attend sur LiveFoot.",
    icon: "/livefoot-brand-v2.svg?v=20260813",
    badge: "/livefoot-brand-v2.svg?v=20260813",
    tag: payload.tag || "livefoot-notification",
    renotify: false,
    data: { url: payload.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) { await existing.focus(); existing.navigate(url); return; }
    await self.clients.openWindow(url);
  })());
});

