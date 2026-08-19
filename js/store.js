/* ==========================================================
   store.js — שכבת הנתונים
   כל הנתונים נשמרים מקומית במכשיר (localStorage).
   אם מוגדר סנכרון ענן, sync.js דוחף/מושך את אותם נתונים.
   ========================================================== */

const DB_KEY = 'kupot_db_v1';
const DB_BACKUP_KEY = 'kupot_db_v1_backup'; // עותק שני, מגן מפני קובץ ראשי פגום

const Store = (() => {

  const EMPTY = {
    version: 1,
    holders: [],      // מחזיקים
    boxes: [],        // קופות
    collections: [],  // אירועי אסיפה
    collectors: [],   // מתרימים
    settings: {
      orgName: '',
      currency: '₪',
      reminderDays: 90,     // אחרי כמה ימים קופה נחשבת "ממתינה"
      cloud: {
        url: 'https://mnkjgugztrqqfxxqajne.supabase.co',
        key: 'sb_publishable_0MdNfJbh-fYiGOUgovHbQg_3UpYX6Oe',
        enabled: true
      },
      deviceName: '',
      lastBackupExport: null,
      // תאריך עדכון אחרון לכל שדה בנפרד — כדי שעריכת שדה אחד במכשיר
      // אחד לא תדרוס בטעות שדה אחר שעודכן לאחרונה במכשיר אחר
      orgNameUpdatedAt: null,
      currencyUpdatedAt: null,
      reminderDaysUpdatedAt: null
    },
    meta: { lastPull: null, lastPush: null }
  };

  let db = null;
  const listeners = [];

  /* ---------- עזרים ---------- */

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function nowISO() { return new Date().toISOString(); }

  function today() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- טעינה ושמירה ---------- */

  function load() {
    // מנסים קודם את הקובץ הראשי, ואם הוא חסר/פגום נופלים לעותק הגיבוי
    // כדי שתקלה נקודתית (כתיבה שנקטעה, למשל) לא תמחק את כל ההיסטוריה
    const raw = safeGet(DB_KEY);
    const rawBackup = safeGet(DB_BACKUP_KEY);
    let parsed = tryParse(raw);
    if (!parsed && rawBackup) {
      parsed = tryParse(rawBackup);
      if (parsed && window.UI) setTimeout(() => UI.toast('שוחזר מגיבוי אוטומטי אחרי תקלה בשמירה', 'err'), 300);
    }
    db = parsed ? migrate(parsed) : clone(EMPTY);

    if (!db.settings.deviceName) {
      db.settings.deviceName = 'מכשיר-' + Math.random().toString(36).slice(2, 6);
    }
    requestPersistentStorage();
    return db;
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); }
    catch (e) { console.error('שגיאה בקריאה מהאחסון', e); return null; }
  }

  function tryParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { console.error('קובץ נתונים פגום', e); return null; }
  }

  /** מבקש מהדפדפן לא לפנות את האחסון של האתר גם כשהמכשיר צריך מקום */
  function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }

  function migrate(loaded) {
    // ממזג עם המבנה הריק כדי ששדות חדשים לא יחסרו בגרסאות עתידיות
    const out = clone(EMPTY);
    for (const k of ['holders', 'boxes', 'collections', 'collectors']) {
      if (Array.isArray(loaded[k])) out[k] = loaded[k];
    }
    Object.assign(out.settings, loaded.settings || {});
    out.settings.cloud = Object.assign({}, EMPTY.settings.cloud, (loaded.settings || {}).cloud || {});
    Object.assign(out.meta, loaded.meta || {});
    return out;
  }

  function save() {
    try {
      const serialized = JSON.stringify(db);
      // שומרים את המצב הקודם כגיבוי לפני שדורסים אותו, כדי שכתיבה
      // שנקטעה (למשל הדפדפן נסגר באמצע) תשאיר עותק תקין אחד אחורה
      const prevRaw = safeGet(DB_KEY);
      if (prevRaw) safeSet(DB_BACKUP_KEY, prevRaw);
      localStorage.setItem(DB_KEY, serialized);
    } catch (e) {
      console.error('שגיאה בשמירה', e);
      if (window.UI) UI.toast('שגיאה בשמירה — ייתכן שאין מקום פנוי במכשיר', 'err');
      return false;
    }
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    if (window.Sync) Sync.schedulePush();
    return true;
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* לא קריטי, הגיבוי הראשי חשוב יותר */ }
  }

  function onChange(fn) { listeners.push(fn); }

  function data() { return db; }

  /** כמה ימים עברו מאז שיוצא קובץ גיבוי (JSON) אחרון. null אם מעולם לא */
  function daysSinceBackup() {
    const last = db.settings.lastBackupExport;
    if (!last) return null;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }

  function markBackupExported() {
    db.settings.lastBackupExport = nowISO();
    save();
  }

  /** מסמן ששדה הגדרה מסוים (שם ארגון / מטבע / ימי תזכורת) השתנה עכשיו,
   * כדי ש-sync.js ימזג נכון בין מכשירים ברמת שדה בודד ולא ידרוס שדות אחרים */
  function touchSettingsField(field) {
    const key = field + 'UpdatedAt';
    if (key in db.settings) db.settings[key] = nowISO();
    save();
  }

  /* ---------- מחזיקים ---------- */

  function holders() { return db.holders.filter(h => !h.deleted); }

  function holder(id) { return db.holders.find(h => h.id === id) || null; }

  function saveHolder(input) {
    let h = input.id ? db.holders.find(x => x.id === input.id) : null;
    if (!h) {
      h = { id: uid(), created_at: nowISO() };
      db.holders.push(h);
    }
    Object.assign(h, {
      name: (input.name || '').trim(),
      phone: (input.phone || '').trim(),
      address: (input.address || '').trim(),
      city: (input.city || '').trim(),
      area: (input.area || '').trim(),
      notes: (input.notes || '').trim(),
      deleted: !!input.deleted,
      updated_at: nowISO()
    });
    save();
    return h;
  }

  function deleteHolder(id) {
    const h = holder(id);
    if (!h) return;
    h.deleted = true;
    h.updated_at = nowISO();
    // הקופות של המחזיק עוברות לסטטוס "ללא מחזיק"
    db.boxes.filter(b => b.holder_id === id).forEach(b => {
      b.holder_id = null;
      b.status = 'available';
      b.updated_at = nowISO();
    });
    save();
  }

  /* ---------- קופות ---------- */

  function boxes() { return db.boxes.filter(b => !b.deleted); }

  function box(id) { return db.boxes.find(b => b.id === id) || null; }

  function saveBox(input) {
    let b = input.id ? db.boxes.find(x => x.id === input.id) : null;
    if (!b) {
      b = { id: uid(), created_at: nowISO() };
      db.boxes.push(b);
    }
    Object.assign(b, {
      serial: (input.serial || '').trim(),
      holder_id: input.holder_id || null,
      type: input.type || 'רגילה',
      status: input.status || (input.holder_id ? 'placed' : 'available'),
      placed_date: input.placed_date || null,
      notes: (input.notes || '').trim(),
      deleted: !!input.deleted,
      updated_at: nowISO()
    });
    save();
    return b;
  }

  function deleteBox(id) {
    const b = box(id);
    if (!b) return;
    b.deleted = true;
    b.updated_at = nowISO();
    save();
  }

  /** האם מספר סידורי כבר קיים אצל קופה אחרת */
  function serialTaken(serial, exceptId) {
    const s = (serial || '').trim().toLowerCase();
    if (!s) return false;
    return boxes().some(b => b.id !== exceptId && (b.serial || '').trim().toLowerCase() === s);
  }

  /* ---------- מתרימים ---------- */

  function collectors() { return db.collectors.filter(c => !c.deleted); }

  function collector(id) { return db.collectors.find(c => c.id === id) || null; }

  function saveCollector(input) {
    let c = input.id ? db.collectors.find(x => x.id === input.id) : null;
    if (!c) {
      c = { id: uid(), created_at: nowISO() };
      db.collectors.push(c);
    }
    Object.assign(c, {
      name: (input.name || '').trim(),
      phone: (input.phone || '').trim(),
      deleted: !!input.deleted,
      updated_at: nowISO()
    });
    save();
    return c;
  }

  function deleteCollector(id) {
    const c = collector(id);
    if (!c) return;
    c.deleted = true;
    c.updated_at = nowISO();
    save();
  }

  /* ---------- אסיפות ---------- */

  function collections() { return db.collections.filter(c => !c.deleted); }

  function collectionsFor(boxId) {
    return collections()
      .filter(c => c.box_id === boxId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function collectionsForHolder(holderId) {
    const ids = boxes().filter(b => b.holder_id === holderId).map(b => b.id);
    return collections()
      .filter(c => ids.includes(c.box_id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function saveCollection(input) {
    let c = input.id ? db.collections.find(x => x.id === input.id) : null;
    if (!c) {
      c = { id: uid(), created_at: nowISO(), receipt_number: null };
      db.collections.push(c);
    }
    Object.assign(c, {
      box_id: input.box_id,
      collector_id: input.collector_id || null,
      date: input.date || today(),
      amount: Number(input.amount) || 0,
      outcome: input.outcome || 'collected', // collected | no_answer | refused | empty
      notes: (input.notes || '').trim(),
      settled: !!input.settled,           // האם הכסף הועבר לקופה המרכזית
      deleted: !!input.deleted,
      updated_at: nowISO()
    });
    // מספר קבלה מונפק אוטומטית ע"י sync.js בסנכרון הבא (כדי שיהיה
    // ייחודי בין כל המכשירים, ולא רק "מקומי" לכל מכשיר בנפרד)
    save();
    return c;
  }

  function deleteCollection(id) {
    const c = db.collections.find(x => x.id === id);
    if (!c) return;
    c.deleted = true;
    c.updated_at = nowISO();
    save();
  }

  /* ---------- שאילתות נגזרות ---------- */

  /** תאריך האסיפה האחרונה של קופה (רק ביקורים שבהם באמת נאסף כסף) */
  function lastCollectionDate(boxId) {
    const list = collectionsFor(boxId).filter(c => c.outcome === 'collected');
    return list.length ? list[0].date : null;
  }

  /** מספר ימים מאז האסיפה האחרונה. אם מעולם לא נאספה — מאז ההצבה. null אם אין כלום */
  function daysSince(boxId) {
    const b = box(boxId);
    const ref = lastCollectionDate(boxId) || (b && b.placed_date) || null;
    if (!ref) return null;
    const diff = Date.now() - new Date(ref + 'T00:00:00').getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }

  /** קופות שממתינות לאיסוף, ממוינות מהוותיקה ביותר */
  function dueBoxes() {
    const limit = Number(db.settings.reminderDays) || 90;
    return boxes()
      .filter(b => b.status === 'placed' && b.holder_id)
      .map(b => ({ box: b, days: daysSince(b.id) }))
      .filter(x => x.days === null || x.days >= limit)
      .sort((a, b) => (b.days === null ? 99999 : b.days) - (a.days === null ? 99999 : a.days));
  }

  /** סכום שנאסף בטווח תאריכים (כולל) */
  function totalBetween(fromDate, toDate) {
    return collections()
      .filter(c => c.outcome === 'collected' && c.date >= fromDate && c.date <= toDate)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }

  /** סיכום חודשי לצורך גרף — מחזיר N החודשים האחרונים */
  function monthlyTotals(months = 6) {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < months; i++) {
      const y = d.getFullYear(), m = d.getMonth();
      const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      out.unshift({ key: from.slice(0, 7), year: y, month: m + 1, total: totalBetween(from, to) });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }

  /** יתרה פתוחה לכל מתרים — כסף שנאסף ועדיין לא סומן כהועבר */
  function unsettledByCollector() {
    const map = new Map();
    collections()
      .filter(c => c.outcome === 'collected' && !c.settled)
      .forEach(c => {
        const key = c.collector_id || '_none';
        map.set(key, (map.get(key) || 0) + (Number(c.amount) || 0));
      });
    return [...map.entries()]
      .map(([id, total]) => ({
        id: id === '_none' ? null : id,
        name: id === '_none' ? 'ללא מתרים' : (collector(id) ? collector(id).name : 'מתרים שנמחק'),
        total
      }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  /* ---------- גיבוי / שחזור ---------- */

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importJSON(text, mode = 'replace') {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('קובץ לא תקין');
    if (mode === 'replace') {
      db = migrate(parsed);
    } else {
      // מיזוג: רשומה עם updated_at חדש יותר מנצחת
      for (const table of ['holders', 'boxes', 'collections', 'collectors']) {
        const incoming = Array.isArray(parsed[table]) ? parsed[table] : [];
        const byId = new Map(db[table].map(r => [r.id, r]));
        for (const row of incoming) {
          const cur = byId.get(row.id);
          if (!cur || (row.updated_at || '') > (cur.updated_at || '')) {
            if (cur) Object.assign(cur, row);
            else db[table].push(row);
          }
        }
      }
    }
    save();
  }

  function exportCSV(rows, headers) {
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(h => esc(h.label)).join(',')];
    for (const r of rows) lines.push(headers.map(h => esc(h.get(r))).join(','));
    // BOM כדי שאקסל בעברית יפתח נכון
    return '﻿' + lines.join('\r\n');
  }

  function resetAll() {
    const cloud = clone(db.settings.cloud);
    const deviceName = db.settings.deviceName;
    db = clone(EMPTY);
    db.settings.cloud = cloud;
    db.settings.deviceName = deviceName;
    save();
  }

  /* ---------- דמו ---------- */

  function seedDemo() {
    const areas = ['מרכז העיר', 'שכונה צפונית', 'שכונה דרומית'];
    const names = [
      ['משפחת כהן', '052-1234567', 'הרצל 12', 'ירושלים'],
      ['משפחת לוי', '053-7654321', 'בן יהודה 5', 'ירושלים'],
      ['מכולת השלום', '02-5551234', 'יפו 88', 'ירושלים'],
      ['משפחת פרידמן', '054-9998877', 'אגריפס 30', 'ירושלים'],
      ['בית כנסת אור החיים', '', 'שמואל הנביא 4', 'ירושלים'],
      ['משפחת מזרחי', '050-1112233', 'קינג ג׳ורג׳ 21', 'ירושלים']
    ];
    const c1 = saveCollector({ name: 'יוסי', phone: '052-0000001' });
    const c2 = saveCollector({ name: 'אבי', phone: '052-0000002' });
    const cols = [c1, c2];

    names.forEach((n, i) => {
      const h = saveHolder({
        name: n[0], phone: n[1], address: n[2], city: n[3],
        area: areas[i % areas.length]
      });
      const b = saveBox({
        serial: 'ק-' + String(101 + i),
        holder_id: h.id,
        status: 'placed',
        placed_date: '2025-01-15'
      });
      // 2-3 אסיפות היסטוריות
      const n_events = 2 + (i % 2);
      for (let k = 0; k < n_events; k++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (k * 3 + 1));
        const p = x => String(x).padStart(2, '0');
        saveCollection({
          box_id: b.id,
          collector_id: cols[i % 2].id,
          date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
          amount: 80 + Math.round(Math.random() * 320),
          outcome: 'collected',
          settled: k > 0
        });
      }
    });
    save();
  }

  /* ---------- API ---------- */

  return {
    load, save, data, onChange, uid, nowISO, today,
    holders, holder, saveHolder, deleteHolder,
    boxes, box, saveBox, deleteBox, serialTaken,
    collectors, collector, saveCollector, deleteCollector,
    collections, collectionsFor, collectionsForHolder, saveCollection, deleteCollection,
    lastCollectionDate, daysSince, dueBoxes, totalBetween, monthlyTotals, unsettledByCollector,
    exportJSON, importJSON, exportCSV, resetAll, seedDemo,
    daysSinceBackup, markBackupExported, touchSettingsField
  };
})();
