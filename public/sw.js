// AIQYN: офлайн-страница и push-уведомления. Страницы сайта не кешируем —
// новые версии приходят сразу; при потере сети переходы показывают /offline.html.
const CACHE = "aiqyn-offline-v3";
const OFFLINE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  // кеш офлайн-страницы — не обязателен: если не удалось, воркер всё равно активируется (иначе не будет push)
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
});

// push от сервера: показываем уведомление с иконкой AIQYN
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: "AIQYN", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "AIQYN", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || undefined,
      renotify: true,
      data: { url: d.url || "/notifications" },
    })
  );
});

// нажатие на уведомление — открыть нужную карточку (или переключиться на открытую вкладку)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/notifications", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
