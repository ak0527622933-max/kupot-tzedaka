/* ==========================================================
   sw.js — מנגנון "כיבוי עצמי"
   ה-Service Worker הקודם גרם ליותר בעיות משהוא פתר (מכשירים
   נתקעו על גרסאות ישנות של הקוד). הקובץ הזה מחליף אותו, מנקה
   את כל המטמון הישן, ומבטל את עצמו — כדי שמעכשיו הדפדפן פשוט
   יביא תמיד את הקבצים העדכניים ישירות מהרשת (עם ?v= בשמות
   הקבצים כדי לוודא רענון אמיתי בכל עדכון).
   ========================================================== */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});
