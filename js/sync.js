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

  /** משווה שני תאריכי ISO כתאריכים אמיתיים, לא כטקסט — Supabase
   * מחזיר "...175+00:00" בעוד שהמכשיר יוצר "...175Z", וזה אותו רגע
   * בדיוק אבל השוואת טקסט פשוטה הייתה עלולה "לבלוע" עדכון מהענן */
  function isNewer(a, b) {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    return ta > tb;
  }

  /** מנפיק מספרי קבלה לאסיפות שנאסף בהן כסף ועדיין אין להן מספר —
   * דרך פונקציה אטומית בשרת, כדי שלא ייווצרו מספרים כפולים כשכמה
   * מכשירים מנפיקים קבלות במקביל */
  async function issuePendingReceipts() {
    const db = Store.data();
    const pending = db.collections.filter(c => !c.deleted && c.outcome === 'collected' && !c.receipt_number);
    for (const c of pending) {
      try {
        const n = await req('/rest/v1/rpc/issue_receipt_number', { method: 'POST', body: JSON.stringify({}) });
        if (typeof n === 'number') {
          c.receipt_number = n;
          c.updated_at = Store.nowISO();
        }
      } catch (e) {
        console.error('שגיאה בהנפקת מספר קבלה', e);
      }
    }
    if (pending.length) Store.save();
  }

  /** דוחף רשומות מקומיות שהשתנו מאז lastPush */
  async function push() {
    if (!isConfigured()) return;
    const db = Store.data();
    await issuePendingReceipts();
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
        } else if (isNewer(row.updated_at, cur.updated_at)) {
          Object.assign(cur, row);
          changed = true;
        }
      }
    }
    db.meta.lastPull = Store.nowISO();
    return changed;
  }

  /** מסנכרן את הגדרות הארגון (שם/מטבע/ימי תזכורת) ברמת שדה בודד:
   * קודם מושכים את המצב בענן, לוקחים לכל שדה בנפרד את הגרסה העדכנית
   * יותר (מקומי מול ענן), ורק אז דוחפים את התוצאה הממוזגת בחזרה —
   * כך שדה שנערך במכשיר אחד לעולם לא דורס שדה אחר שנערך במכשיר אחר */
  async function syncSettings() {
    if (!isConfigured()) return false;
    const s = Store.data().settings;
    const rows = await req('/rest/v1/app_settings?id=eq.main&select=*');
    const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
    let changed = false;

    function mergeField(localKey, tsKey, remoteValKey, remoteTsKey, fallback) {
      if (!r) return;
      const remoteHasValue = r[remoteValKey] !== null && r[remoteValKey] !== undefined && r[remoteValKey] !== '';
      const localHasValue = s[localKey] !== null && s[localKey] !== undefined && s[localKey] !== '';
      // אם לאף צד אין תאריך אמיתי (נתון ישן שקדם למנגנון הזה), לא
      // "מנצחים" לפי זמן — פשוט מאמצים את הערך הקיים בענן אם יש כזה
      // ולמכשיר הזה עדיין אין כלום מקומית
      const bothTimestampsMissing = !r[remoteTsKey] && !s[tsKey];
      if (bothTimestampsMissing) {
        if (remoteHasValue && !localHasValue) { s[localKey] = r[remoteValKey]; changed = true; }
        return;
      }
      if (isNewer(r[remoteTsKey], s[tsKey])) {
        s[localKey] = remoteHasValue ? r[remoteValKey] : fallback;
        s[tsKey] = r[remoteTsKey];
        changed = true;
      }
    }
    mergeField('orgName', 'orgNameUpdatedAt', 'org_name', 'org_name_updated_at', '');
    mergeField('currency', 'currencyUpdatedAt', 'currency', 'currency_updated_at', '₪');
    mergeField('reminderDays', 'reminderDaysUpdatedAt', 'reminder_days', 'reminder_days_updated_at', 90);

    // דוחפים שדה רק אם המכשיר הזה אי-פעם נגע בו בפועל (יש לו תאריך
    // מקומי אמיתי). אחרת מכשיר ש"לא יודע" כלום על השדה הזה (למשל
    // מכשיר טרי, או שדה שמעולם לא נערך דרכו) עלול לדרוס בטעות ערך
    // אמיתי בענן עם ערך ריק/ברירת-מחדל מקומי
    const payload = { id: 'main' };
    if (s.orgNameUpdatedAt) { payload.org_name = s.orgName; payload.org_name_updated_at = s.orgNameUpdatedAt; }
    if (s.currencyUpdatedAt) { payload.currency = s.currency; payload.currency_updated_at = s.currencyUpdatedAt; }
    if (s.reminderDaysUpdatedAt) { payload.reminder_days = s.reminderDays; payload.reminder_days_updated_at = s.reminderDaysUpdatedAt; }

    if (Object.keys(payload).length > 1) {
      await req('/rest/v1/app_settings?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify([payload])
      });
    }
    return changed;
  }

  async function syncNow(showToast) {
    if (!isConfigured()) { setStatus('off'); return; }
    setStatus('syncing');
    try {
      // חשוב: קודם מושכים (pull), ורק אחר-כך דוחפים (push). אם מכשיר
      // עם עותק מקומי מיושן היה דוחף קודם, הוא היה עלול לדרוס בענן
      // שינוי חדש יותר שנעשה במכשיר אחר (למשל למחוק "מחיקה" של רשומה)
      // — כי הדחיפה עצמה לא בודקת תאריכים מול הענן, רק כותבת. מושכים
      // קודם כדי שהמכשיר "ילמד" קודם מה חדש יותר, ורק אז ישדר בחזרה
      const changedData = await pull();
      await push();
      const changedSettings = await syncSettings();
      const changed = changedData || changedSettings;
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
