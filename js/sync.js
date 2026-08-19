/* ==========================================================
   sync.js — סנכרון ענן אופציונלי (Supabase REST)
   אם לא הוגדר, הכל עובד מקומית בלבד ללא שגיאות.
   אסטרטגיית מיזוג: "האחרון שנערך מנצח" לפי updated_at,
   מספיק טוב לצוות קטן של 1-3 מתרימים.
   ========================================================== */

const Sync = (() => {
  let pushTimer = null;
  let pulling = false;
  let status = 'idle'; // idle | syncing | ok | err | off

  function cfg() {
    const c = Store.data().settings.cloud || {};
    return { url: (c.url || '').replace(/\/+$/, ''), key: c.key || '', enabled: !!c.enabled };
  }

  function isConfigured() {
    const c = cfg();
    return c.enabled && c.url && c.key;
  }

  function setStatus(s) {
    status = s;
    if (window.UI) UI.updateSyncBadge(s);
  }
  function getStatus() { return status; }

  async function req(path, opts = {}) {
    const c = cfg();
    const res = await fetch(c.url + path, {
      ...opts,
      headers: {
        'apikey': c.key,
        'Authorization': 'Bearer ' + c.key,
        'Content-Type': 'application/json',
        'Prefer': opts.prefer || 'return=representation',
        ...(opts.headers || {})
      }
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`שגיאת שרת ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    // בקשות עם "Prefer: return=minimal" (למשל הדחיפה שלנו) מחזירות גוף
    // ריק גם כשהפעולה הצליחה — לא ננסה לפרש JSON ממחרוזת ריקה
    if (!bodyText) return null;
    try {
      return JSON.parse(bodyText);
    } catch (e) {
      throw new Error('תשובה לא תקינה מהשרת');
    }
  }

  const TABLES = ['holders', 'boxes', 'collectors', 'collections'];

  /** דוחף רשומות מקומיות שהשתנו מאז lastPush */
  async function push() {
    if (!isConfigured()) return;
    const db = Store.data();
    for (const t of TABLES) {
      const rows = db[t];
      if (!rows.length) continue;
      await req(`/rest/v1/${t}?on_conflict=id`, {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(rows)
      });
    }
    db.meta.lastPush = Store.nowISO();
  }

  /** מושך רשומות מהענן וממזג לפי updated_at */
  async function pull() {
    if (!isConfigured()) return;
    const db = Store.data();
    let changed = false;
    for (const t of TABLES) {
      const remote = await req(`/rest/v1/${t}?select=*&order=updated_at.asc`);
      if (!Array.isArray(remote)) continue;
      const byId = new Map(db[t].map(r => [r.id, r]));
      for (const row of remote) {
        const cur = byId.get(row.id);
        if (!cur) {
          db[t].push(row);
          byId.set(row.id, row);
          changed = true;
        } else if ((row.updated_at || '') > (cur.updated_at || '')) {
          Object.assign(cur, row);
          changed = true;
        }
      }
    }
    db.meta.lastPull = Store.nowISO();
    return changed;
  }

  async function syncNow(showToast) {
    if (!isConfigured()) { setStatus('off'); return; }
    setStatus('syncing');
    try {
      await push();
      const changed = await pull();
      localStorage.setItem('kupot_db_v1', JSON.stringify(Store.data()));
      setStatus('ok');
      if (changed && window.App) App.rerender();
      if (showToast && window.UI) UI.toast('הסנכרון הושלם', 'ok');
    } catch (e) {
      console.error('שגיאת סנכרון', e);
      setStatus('err');
      if (showToast && window.UI) UI.toast('סנכרון נכשל: ' + e.message, 'err');
    }
  }

  function schedulePush() {
    if (!isConfigured()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(false), 1500);
  }

  /** בדיקת חיבור להגדרות — לא ממזג, רק מוודא שהמפתחות תקינים */
  async function testConnection(url, key) {
    const res = await fetch(url.replace(/\/+$/, '') + '/rest/v1/holders?select=id&limit=1', {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) throw new Error('לא ניתן להתחבר (קוד ' + res.status + ')');
    return true;
  }

  function init() {
    if (isConfigured()) {
      syncNow(false);
      setInterval(() => syncNow(false), 15000);
    } else {
      setStatus('off');
    }
    window.addEventListener('online', () => syncNow(false));
  }

  return { init, syncNow, schedulePush, isConfigured, testConnection, getStatus };
})();
