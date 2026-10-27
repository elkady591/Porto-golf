// Offline shell + background reminder check for Porto Golf.
const SHELL = "chalet-shell-v16";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("chalet-shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the page so updates on GitHub show up; fall back to cache when offline.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && new URL(e.request.url).origin === location.origin) {
          const copy = r.clone();
          caches.open(SHELL).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});

// Runs only where the browser supports Periodic Background Sync (Chrome on Android, installed app).
self.addEventListener("periodicsync", e => {
  if (e.tag === "chalet-check") e.waitUntil(checkDue());
});

async function checkDue() {
  const c = await caches.open("chalet-state");
  const r = await c.match("state.json");
  if (!r) return;
  const { due = [], lang = "ar", dir = "rtl", text = {} } = await r.json();
  const bad = text.bad || "رصيد {m} قرب يخلص. اشحن النهارده.";
  const soon = text.soon || "فاضل حوالي {n} يوم في رصيد {m}. اشحن قريب.";
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
  const now = Date.now();
  for (const m of due) {
    if (now < m.rechargeBy) continue;
    const days = Math.max(0, Math.round((m.emptyAt - now) / 86400000));
    const body = days <= 1 ? fill(bad, { m: m.label }) : fill(soon, { m: m.label, n: days });
    await self.registration.showNotification("Porto Golf", {
      body, icon: "icon-192.png", badge: "icon-192.png", tag: "chalet-" + m.key, lang, dir
    });
  }
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(list => {
      for (const w of list) if ("focus" in w) return w.focus();
      return self.clients.openWindow("./");
    })
  );
});
