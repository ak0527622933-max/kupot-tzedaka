/* ==========================================================
   sw.js — Service Worker: מטמון לעבודה אופליין
   הנתונים עצמם ב-localStorage, זמינים תמיד. כאן רק שומרים
   את קבצי האפליקציה עצמם כדי שהיא תיפתח גם בלי אינטרנט.
   ========================================================== */

const CACHE_NAME = 'kupot-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/store.js',
  './js/sync.js',
  './js/ui.js',
  './js/forms.js',
  './js/views.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // בקשות רשת (למשל ל-Supabase) — עוברות ישר לרשת, לא מטמון
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // "רשת קודם" — תמיד מנסים להביא את הגרסה העדכנית מהאינטרנט,
  // ורק אם אין חיבור בכלל נופלים לגרסה השמורה. כך עדכוני קוד
  // מגיעים מיד במקום להיתקע על גרסה ישנה שנשמרה במטמון
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
