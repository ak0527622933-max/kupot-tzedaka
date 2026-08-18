/* ==========================================================
   views.js — מסכי האפליקציה
   כל פונקציית View מחזירה HTML (string) ומצרפת מאזיני אירועים
   אחרי שהיא מוזרקת ל-DOM ע"י app.js
   ========================================================== */

const Views = (() => {
  const { esc, fmtMoney, fmtDate, fmtDateShort, daysLabel, initials } = UI;

  /* ============================================================
     דשבורד
     ============================================================ */

  function dashboard() {
    const boxes = Store.boxes();
    const due = Store.dueBoxes();
    const months = Store.monthlyTotals(1);
    const thisMonth = months[0] ? months[0].total : 0;
    const unsettled = Store.unsettledByCollector();
    const unsettledTotal = unsettled.reduce((s, x) => s + x.total, 0);
    const placed = boxes.filter(b => b.status === 'placed').length;

    if (boxes.length === 0) return onboarding();

    const backupDays = Store.daysSinceBackup();
    const backupWarn = backupDays === null || backupDays > 30;
    const backupBanner = backupWarn ? `
      <div class="card card-pad mt" style="margin-bottom:14px" data-nav="settings-backup">
        <div style="display:flex;align-items:center;gap:12px;cursor:pointer">
          <div class="avatar gold">💾</div>
          <div class="li-main">
            <div class="li-title">${backupDays === null ? 'עדיין לא בוצע גיבוי' : `לא בוצע גיבוי כבר ${backupDays} ימים`}</div>
            <div class="li-sub">מומלץ לגבות את הנתונים — לוחצים כאן</div>
          </div>
        </div>
      </div>` : '';

    const dueItems = due.slice(0, 6).map(({ box, days }) => {
      const h = box.holder_id ? Store.holder(box.holder_id) : null;
      return `<li data-nav="box" data-id="${box.id}">
        <div class="avatar gold">${esc(initials(h ? h.name : box.serial))}</div>
        <div class="li-main">
          <div class="li-title">${esc(h ? h.name : 'קופה ' + box.serial)}</div>
          <div class="li-sub">${esc(box.serial)}${h ? ' · ' + esc(h.area || h.city || '') : ''}</div>
        </div>
        <div class="li-end">
          <span class="pill warn">${daysLabel(days)}</span>
        </div>
      </li>`;
    }).join('');

    return `
      ${backupBanner}
      <div class="stats">
        <div class="stat accent">
          <div class="label">נאסף החודש</div>
          <div class="value money">${fmtMoney(thisMonth)}</div>
        </div>
        <div class="stat">
          <div class="label">קופות בשטח</div>
          <div class="value">${placed}</div>
          <div class="sub">מתוך ${boxes.length} קופות</div>
        </div>
        <div class="stat warn">
          <div class="label">ממתינות לאיסוף</div>
          <div class="value">${due.length}</div>
        </div>
        <div class="stat ${unsettledTotal ? 'danger' : ''}">
          <div class="label">יתרה לא הועברה</div>
          <div class="value money">${fmtMoney(unsettledTotal)}</div>
        </div>
      </div>

      <div class="section-title">קופות שממתינות לאיסוף</div>
      <div class="card">
        ${dueItems ? `<ul class="list">${dueItems}</ul>` : `
          <div class="empty" style="padding:28px 20px">
            <div class="big">✓</div>
            <p>אין קופות שממתינות כרגע</p>
          </div>`}
        ${due.length > 6 ? `<div class="card-pad center"><a class="plain" href="#/boxes?filter=due">הצג את כל ה-${due.length}</a></div>` : ''}
      </div>

      <div class="section-title">קיצורי דרך</div>
      <div class="btn-row">
        <button class="btn primary block" data-nav="collect">+ רישום אסיפה</button>
        <button class="btn block" data-nav="box-new">+ קופה חדשה</button>
      </div>
    `;
  }

  /** מסך פתיחה מודרך — מוצג רק כשאין עדיין אף קופה במערכת */
  function onboarding() {
    return `
      <div class="card card-pad center" style="padding:28px 20px">
        <div class="big" style="font-size:2.6rem;margin-bottom:6px">👋</div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px">ברוכים הבאים!</div>
        <p class="dim" style="font-size:.9rem">בואו נגדיר את המערכת ב-3 צעדים קצרים</p>
      </div>

      <div class="section-title">שלב 1 — הוספת בית ראשון עם קופה</div>
      <div class="card card-pad">
        <p class="dim" style="font-size:.87rem;margin-bottom:10px">מזינים שם, כתובת, ומספר לקופה שמונחת שם. אפשר להוסיף עוד בהמשך בכל עת.</p>
        <button class="btn primary block" id="obAddHolder">+ הוספת בית וקופה</button>
      </div>

      <div class="section-title">שלב 2 — הוספת מתרים (אופציונלי)</div>
      <div class="card card-pad">
        <p class="dim" style="font-size:.87rem;margin-bottom:10px">מי שיוצא לאסוף את הכסף בשטח. אפשר לדלג ולהוסיף מאוחר יותר.</p>
        <button class="btn block" id="obAddCollector">+ הוספת מתרים</button>
      </div>

      <div class="section-title">שלב 3 — נסו את מסך "אסיפה"</div>
      <div class="card card-pad">
        <p class="dim" style="font-size:.87rem;margin-bottom:10px">כשיהיה לפחות בית אחד עם קופה, כאן תרשמו כל ביקור.</p>
      </div>

      <div class="card card-pad mt">
        <p class="dim" style="font-size:.85rem;margin-bottom:10px">רוצים רק להתרשם קודם? אפשר לטעון נתוני דוגמה ולמחוק אותם אחר כך.</p>
        <button class="btn block" id="obSeedDemo">טעינת נתוני דוגמה</button>
      </div>
    `;
  }

  function wireDashboard(root) {
    root.querySelectorAll('[data-nav="box"]').forEach(li => {
      li.addEventListener('click', () => location.hash = '#/boxes/' + li.dataset.id);
    });
    const cBtn = root.querySelector('[data-nav="collect"]');
    if (cBtn) cBtn.addEventListener('click', () => location.hash = '#/collect');
    const nBtn = root.querySelector('[data-nav="box-new"]');
    if (nBtn) nBtn.addEventListener('click', () => Forms.openBoxForm());

    const backupNav = root.querySelector('[data-nav="settings-backup"]');
    if (backupNav) backupNav.addEventListener('click', () => location.hash = '#/settings');

    const obHolder = root.querySelector('#obAddHolder');
    if (obHolder) obHolder.addEventListener('click', () => {
      Forms.openHolderForm(null, (h) => {
        // ממשיכים ישר לטופס הקופה עם המחזיק שנוצר, כדי שהצעד ירגיש אחיד
        Forms.openBoxForm(null, h.id);
      });
    });
    const obCollector = root.querySelector('#obAddCollector');
    if (obCollector) obCollector.addEventListener('click', () => Forms.openCollectorForm());
    const obSeed = root.querySelector('#obSeedDemo');
    if (obSeed) obSeed.addEventListener('click', () => {
      UI.confirmDialog('נתוני דוגמה', 'להוסיף כמה מחזיקים וקופות לדוגמה כדי להתרשם מהמערכת?', () => {
        Store.seedDemo();
        UI.toast('נתוני הדוגמה נוספו', 'ok');
        App.rerender();
      }, 'הוספה', false);
    });
  }

  /* ============================================================
     אסיפה — בחירת קופה ורישום מהיר
     ============================================================ */

  function collect() {
    const boxes = Store.boxes().filter(b => b.status === 'placed');
    return `
      <div class="search-bar">
        <input type="text" id="collectSearch" placeholder="חיפוש לפי שם מחזיק, כתובת או מספר קופה…" autocomplete="off">
      </div>
      <div class="card">
        <ul class="list" id="collectList">${collectListItems(boxes)}</ul>
      </div>
    `;
  }

  function collectListItems(boxes) {
    if (!boxes.length) {
      return `<li class="nolink"><div class="li-main"><div class="empty" style="padding:20px 0">
        <p>אין קופות פעילות בשטח</p>
        <p class="hint">הוסיפו קופה חדשה במסך "קופות"</p>
      </div></div></li>`;
    }
    return boxes.map(b => {
      const h = b.holder_id ? Store.holder(b.holder_id) : null;
      const days = Store.daysSince(b.id);
      const overdue = days !== null && days >= (Store.data().settings.reminderDays || 90);
      return `<li data-id="${b.id}" data-search="${esc(((h ? h.name + ' ' + (h.address||'') : '') + ' ' + b.serial).toLowerCase())}">
        <div class="avatar ${overdue ? 'gold' : 'ok'}">${esc(initials(h ? h.name : b.serial))}</div>
        <div class="li-main">
          <div class="li-title">${esc(h ? h.name : 'קופה ' + b.serial)}</div>
          <div class="li-sub">${esc(b.serial)}${h && h.address ? ' · ' + esc(h.address) : ''}</div>
        </div>
        <div class="li-end">
          <span class="pill ${overdue ? 'warn' : ''}">${daysLabel(days)}</span>
        </div>
      </li>`;
    }).join('');
  }

  function wireCollect(root) {
    const search = root.querySelector('#collectSearch');
    const list = root.querySelector('#collectList');
    function attachClicks() {
      list.querySelectorAll('li[data-id]').forEach(li => {
        li.addEventListener('click', () => Forms.openCollectionForm(li.dataset.id));
      });
    }
    attachClicks();
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('li[data-search]').forEach(li => {
        li.style.display = li.dataset.search.includes(q) ? '' : 'none';
      });
    });
  }

  /* ============================================================
     קופות / מחזיקים
     ============================================================ */

  function boxesView(sub) {
    const mode = (sub && sub.tab) || 'boxes';
    return `
      <div class="chips">
        <div class="chip ${mode === 'boxes' ? 'on' : ''}" data-mode="boxes">קופות</div>
        <div class="chip ${mode === 'holders' ? 'on' : ''}" data-mode="holders">מחזיקים</div>
      </div>
      <div class="search-bar">
        <input type="text" id="bxSearch" placeholder="${mode === 'boxes' ? 'חיפוש קופה, מחזיק או כתובת…' : 'חיפוש מחזיק, כתובת או טלפון…'}" autocomplete="off">
      </div>
      <div id="bxListWrap"></div>
      <button class="fab" id="bxFab" aria-label="הוספה">+</button>
    `;
  }

  function boxListHTML() {
    const list = Store.boxes().slice().sort((a, b) => (a.serial||'').localeCompare(b.serial||'', 'he'));
    if (!list.length) return emptyState('📦', 'אין עדיין קופות', 'לחצו על + כדי להוסיף קופה ראשונה');
    const items = list.map(b => {
      const h = b.holder_id ? Store.holder(b.holder_id) : null;
      const days = Store.daysSince(b.id);
      const overdue = b.status === 'placed' && days !== null && days >= (Store.data().settings.reminderDays || 90);
      const statusPill = b.status === 'placed'
        ? (overdue ? `<span class="pill warn">${daysLabel(days)}</span>` : `<span class="pill ok">בשטח</span>`)
        : `<span class="pill">פנויה</span>`;
      return `<li data-id="${b.id}" data-search="${esc(((h ? h.name : '') + ' ' + b.serial + ' ' + (h ? h.address : '')).toLowerCase())}">
        <div class="avatar ${overdue ? 'gold' : (b.status === 'placed' ? 'ok' : '')}">${esc(initials(h ? h.name : b.serial))}</div>
        <div class="li-main">
          <div class="li-title">${esc(b.serial || 'ללא מספר')}</div>
          <div class="li-sub">${h ? esc(h.name) : 'ללא מחזיק'}</div>
        </div>
        <div class="li-end">${statusPill}</div>
      </li>`;
    }).join('');
    return `<div class="card"><ul class="list">${items}</ul></div>`;
  }

  function holderListHTML() {
    const list = Store.holders().slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
    if (!list.length) return emptyState('🧑‍🤝‍🧑', 'אין עדיין מחזיקים', 'לחצו על + כדי להוסיף מחזיק ראשון');
    const items = list.map(h => {
      const totalGiven = Store.collectionsForHolder(h.id)
        .filter(c => c.outcome === 'collected')
        .reduce((s, c) => s + Number(c.amount || 0), 0);
      return `<li data-id="${h.id}" data-search="${esc((h.name + ' ' + (h.address||'') + ' ' + (h.phone||'')).toLowerCase())}">
        <div class="avatar">${esc(initials(h.name))}</div>
        <div class="li-main">
          <div class="li-title">${esc(h.name)}</div>
          <div class="li-sub">${esc(h.address || h.phone || '')}</div>
        </div>
        <div class="li-end">
          <div class="li-amount money">${fmtMoney(totalGiven)}</div>
          <div class="li-meta">סה"כ</div>
        </div>
      </li>`;
    }).join('');
    return `<div class="card"><ul class="list">${items}</ul></div>`;
  }

  function emptyState(icon, title, hint) {
    return `<div class="card"><div class="empty">
      <div class="big">${icon}</div>
      <p>${esc(title)}</p>
      <p class="hint">${esc(hint)}</p>
    </div></div>`;
  }

  function wireBoxesView(root, sub) {
    let mode = (sub && sub.tab) || 'boxes';
    const wrap = root.querySelector('#bxListWrap');
    const search = root.querySelector('#bxSearch');
    const fab = root.querySelector('#bxFab');

    function render() {
      wrap.innerHTML = mode === 'boxes' ? boxListHTML() : holderListHTML();
      wrap.querySelectorAll('li[data-id]').forEach(li => {
        li.addEventListener('click', () => {
          location.hash = mode === 'boxes' ? '#/boxes/' + li.dataset.id : '#/holders/' + li.dataset.id;
        });
      });
      filterList();
    }

    function filterList() {
      const q = search.value.trim().toLowerCase();
      wrap.querySelectorAll('li[data-search]').forEach(li => {
        li.style.display = li.dataset.search.includes(q) ? '' : 'none';
      });
    }

    root.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        mode = chip.dataset.mode;
        root.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
        search.value = '';
        search.placeholder = mode === 'boxes' ? 'חיפוש קופה, מחזיק או כתובת…' : 'חיפוש מחזיק, כתובת או טלפון…';
        render();
      });
    });

    search.addEventListener('input', filterList);
    fab.addEventListener('click', () => {
      if (mode === 'boxes') Forms.openBoxForm();
      else Forms.openHolderForm();
    });

    render();
  }

  /* ============================================================
     פרטי קופה
     ============================================================ */

  function boxDetail(id) {
    const b = Store.box(id);
    if (!b) return `<div class="empty"><p>הקופה לא נמצאה</p></div>`;
    const h = b.holder_id ? Store.holder(b.holder_id) : null;
    const history = Store.collectionsFor(id);
    const days = Store.daysSince(id);

    const histItems = history.length ? history.map(c => {
      const outcomeLabel = { collected: 'נאסף', no_answer: 'לא היו בבית', refused: 'סירבו', empty: 'ריקה' }[c.outcome] || c.outcome;
      const pillKind = c.outcome === 'collected' ? 'ok' : (c.outcome === 'refused' ? 'danger' : '');
      return `<li class="nolink">
        <div class="avatar ${pillKind || ''}">${fmtDateShort(c.date)}</div>
        <div class="li-main">
          <div class="li-title">${c.outcome === 'collected' ? fmtMoney(c.amount) : outcomeLabel}</div>
          <div class="li-sub">${c.collector_id && Store.collector(c.collector_id) ? esc(Store.collector(c.collector_id).name) : ''}${c.notes ? ' · ' + esc(c.notes) : ''}</div>
        </div>
        <div class="li-end">
          ${c.outcome === 'collected' ? `<span class="pill ${c.settled ? 'ok' : 'warn'}">${c.settled ? 'הועבר' : 'טרם הועבר'}</span>` : `<span class="pill">${esc(outcomeLabel)}</span>`}
        </div>
      </li>`;
    }).join('') : '';

    return `
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="font-size:1.2rem;font-weight:700">${esc(b.serial || 'ללא מספר')}</div>
            <div class="dim" style="font-size:.88rem;margin-top:2px">${esc(b.type || 'רגילה')}</div>
          </div>
          <span class="pill ${b.status === 'placed' ? 'ok' : ''}">${b.status === 'placed' ? 'בשטח' : 'פנויה'}</span>
        </div>
        ${b.status === 'placed' ? `<div class="mt dim" style="font-size:.85rem">${daysLabel(days)}</div>` : ''}
        ${b.notes ? `<div class="mt" style="font-size:.88rem">${esc(b.notes)}</div>` : ''}
      </div>

      <div class="section-title">מחזיק</div>
      <div class="card card-pad" ${h ? 'data-nav="holder"' : ''} style="${h ? 'cursor:pointer' : ''}">
        ${h ? `
          <div style="display:flex;align-items:center;gap:12px">
            <div class="avatar">${esc(initials(h.name))}</div>
            <div class="li-main">
              <div class="li-title">${esc(h.name)}</div>
              <div class="li-sub">${esc(h.address || h.phone || '')}</div>
            </div>
          </div>
        ` : `<div class="dim center" style="padding:6px 0">אין מחזיק משויך לקופה זו</div>`}
      </div>

      <div class="btn-row">
        <button class="btn primary block" id="boxCollectBtn">רישום אסיפה</button>
        <button class="btn block" id="boxEditBtn">עריכה</button>
      </div>

      <div class="section-title">היסטוריית אסיפות</div>
      <div class="card">
        ${histItems ? `<ul class="list">${histItems}</ul>` : `<div class="empty" style="padding:26px 20px"><p>עדיין לא נרשמה אסיפה</p></div>`}
      </div>

      <div class="mt center">
        <button class="btn danger sm" id="boxDeleteBtn">מחיקת קופה</button>
      </div>
    `;
  }

  function wireBoxDetail(root, id) {
    const b = Store.box(id);
    if (!b) return;
    const holderNav = root.querySelector('[data-nav="holder"]');
    if (holderNav) holderNav.addEventListener('click', () => location.hash = '#/holders/' + b.holder_id);
    root.querySelector('#boxCollectBtn').addEventListener('click', () => Forms.openCollectionForm(id));
    root.querySelector('#boxEditBtn').addEventListener('click', () => Forms.openBoxForm(b));
    root.querySelector('#boxDeleteBtn').addEventListener('click', () => {
      UI.confirmDialog('מחיקת קופה', `למחוק את קופה ${b.serial}? היסטוריית האסיפות תישמר.`, () => {
        Store.deleteBox(id);
        UI.toast('הקופה נמחקה');
        location.hash = '#/boxes';
      });
    });
  }

  /* ============================================================
     פרטי מחזיק
     ============================================================ */

  function holderDetail(id) {
    const h = Store.holder(id);
    if (!h) return `<div class="empty"><p>המחזיק לא נמצא</p></div>`;
    const boxes = Store.boxes().filter(b => b.holder_id === id);
    const history = Store.collectionsForHolder(id);
    const total = history.filter(c => c.outcome === 'collected').reduce((s, c) => s + Number(c.amount || 0), 0);

    const boxItems = boxes.map(b => `
      <li data-id="${b.id}">
        <div class="avatar ${b.status === 'placed' ? 'ok' : ''}">📦</div>
        <div class="li-main">
          <div class="li-title">${esc(b.serial)}</div>
          <div class="li-sub">${b.status === 'placed' ? 'בשטח' : 'פנויה'}</div>
        </div>
      </li>`).join('');

    const histItems = history.slice(0, 15).map(c => `
      <li class="nolink">
        <div class="avatar ${c.outcome === 'collected' ? 'ok' : ''}">${fmtDateShort(c.date)}</div>
        <div class="li-main">
          <div class="li-title">${c.outcome === 'collected' ? fmtMoney(c.amount) : (c.outcome === 'no_answer' ? 'לא היו בבית' : c.outcome === 'refused' ? 'סירבו' : 'ריקה')}</div>
          <div class="li-sub">${fmtDate(c.date)}</div>
        </div>
      </li>`).join('');

    return `
      <div class="card card-pad">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="avatar" style="width:52px;height:52px;font-size:1.1rem">${esc(initials(h.name))}</div>
          <div>
            <div style="font-size:1.15rem;font-weight:700">${esc(h.name)}</div>
            <div class="dim" style="font-size:.85rem">${esc(h.area || h.city || '')}</div>
          </div>
        </div>
        <div class="mt">
          ${h.phone ? `<div class="kv"><span class="k">טלפון</span><span class="v"><a class="plain" href="tel:${esc(h.phone)}">${esc(h.phone)}</a></span></div>` : ''}
          ${h.address ? `<div class="kv"><span class="k">כתובת</span><span class="v">${esc(h.address)}</span></div>` : ''}
          <div class="kv"><span class="k">סה"כ נתרם</span><span class="v money">${fmtMoney(total)}</span></div>
        </div>
        ${h.notes ? `<div class="note info mt">${esc(h.notes)}</div>` : ''}
      </div>

      <div class="btn-row">
        <button class="btn block" id="holderEditBtn">עריכה</button>
        <button class="btn primary block" id="holderAddBoxBtn">+ קופה חדשה</button>
      </div>

      <div class="section-title">קופות (${boxes.length})</div>
      <div class="card">${boxItems ? `<ul class="list">${boxItems}</ul>` : `<div class="empty" style="padding:20px"><p>אין קופות משויכות</p></div>`}</div>

      <div class="section-title">היסטוריה</div>
      <div class="card">${histItems ? `<ul class="list">${histItems}</ul>` : `<div class="empty" style="padding:20px"><p>אין עדיין היסטוריה</p></div>`}</div>

      <div class="mt center">
        <button class="btn danger sm" id="holderDeleteBtn">מחיקת מחזיק</button>
      </div>
    `;
  }

  function wireHolderDetail(root, id) {
    const h = Store.holder(id);
    if (!h) return;
    root.querySelectorAll('.list li[data-id]').forEach(li => {
      li.addEventListener('click', () => location.hash = '#/boxes/' + li.dataset.id);
    });
    root.querySelector('#holderEditBtn').addEventListener('click', () => Forms.openHolderForm(h));
    root.querySelector('#holderAddBoxBtn').addEventListener('click', () => Forms.openBoxForm(null, h.id));
    root.querySelector('#holderDeleteBtn').addEventListener('click', () => {
      UI.confirmDialog('מחיקת מחזיק', `למחוק את ${h.name}? הקופות המשויכות יהפכו לפנויות.`, () => {
        Store.deleteHolder(id);
        UI.toast('המחזיק נמחק');
        location.hash = '#/boxes';
      });
    });
  }

  /* ============================================================
     דוחות
     ============================================================ */

  function reports() {
    const months = Store.monthlyTotals(6);
    const max = Math.max(1, ...months.map(m => m.total));
    const unsettled = Store.unsettledByCollector();
    const monthNames = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

    const barRows = months.map(m => `
      <div class="bar-row">
        <div class="bar-label">${monthNames[m.month - 1]} ${m.year}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(m.total / max * 100)}%"></div></div>
        <div class="bar-val money">${fmtMoney(m.total)}</div>
      </div>`).join('');

    const unsettledRows = unsettled.length ? unsettled.map(u => `
      <div class="kv"><span class="k">${esc(u.name)}</span><span class="v money">${fmtMoney(u.total)}</span></div>
    `).join('') : `<div class="dim center" style="padding:10px 0">כל היתרות הועברו ✓</div>`;

    return `
      <div class="section-title">איסוף חודשי (6 חודשים אחרונים)</div>
      <div class="card card-pad">${barRows}</div>

      <div class="section-title">יתרות פתוחות למתרימים</div>
      <div class="card card-pad">${unsettledRows}</div>

      <div class="section-title">ייצוא נתונים</div>
      <div class="card card-pad">
        <div class="btn-row">
          <button class="btn block" id="expBoxesCSV">ייצוא קופות (CSV)</button>
          <button class="btn block" id="expHoldersCSV">ייצוא מחזיקים (CSV)</button>
        </div>
        <div class="btn-row">
          <button class="btn block" id="expCollCSV">ייצוא אסיפות (CSV)</button>
        </div>
      </div>
    `;
  }

  function wireReports(root) {
    root.querySelector('#expBoxesCSV').addEventListener('click', () => {
      const csv = Store.exportCSV(Store.boxes(), [
        { label: 'מספר קופה', get: b => b.serial },
        { label: 'סטטוס', get: b => b.status === 'placed' ? 'בשטח' : 'פנויה' },
        { label: 'מחזיק', get: b => b.holder_id && Store.holder(b.holder_id) ? Store.holder(b.holder_id).name : '' },
        { label: 'הערות', get: b => b.notes }
      ]);
      downloadFile('קופות.csv', csv, 'text/csv;charset=utf-8');
    });
    root.querySelector('#expHoldersCSV').addEventListener('click', () => {
      const csv = Store.exportCSV(Store.holders(), [
        { label: 'שם', get: h => h.name },
        { label: 'טלפון', get: h => h.phone },
        { label: 'כתובת', get: h => h.address },
        { label: 'עיר', get: h => h.city },
        { label: 'אזור', get: h => h.area }
      ]);
      downloadFile('מחזיקים.csv', csv, 'text/csv;charset=utf-8');
    });
    root.querySelector('#expCollCSV').addEventListener('click', () => {
      const csv = Store.exportCSV(Store.collections(), [
        { label: 'תאריך', get: c => c.date },
        { label: 'קופה', get: c => Store.box(c.box_id) ? Store.box(c.box_id).serial : '' },
        { label: 'מתרים', get: c => c.collector_id && Store.collector(c.collector_id) ? Store.collector(c.collector_id).name : '' },
        { label: 'סכום', get: c => c.amount },
        { label: 'תוצאה', get: c => c.outcome },
        { label: 'הועבר', get: c => c.settled ? 'כן' : 'לא' },
        { label: 'הערות', get: c => c.notes }
      ]);
      downloadFile('אסיפות.csv', csv, 'text/csv;charset=utf-8');
    });
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ============================================================
     הגדרות
     ============================================================ */

  function settings() {
    const s = Store.data().settings;
    const collectors = Store.collectors();
    const collectorItems = collectors.map(c => `
      <li data-id="${c.id}">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div class="li-main">
          <div class="li-title">${esc(c.name)}</div>
          <div class="li-sub">${esc(c.phone || '')}</div>
        </div>
        <div class="li-end"><button class="btn sm" data-edit-collector="${c.id}">עריכה</button></div>
      </li>`).join('');

    return `
      <div class="section-title">פרטי הארגון</div>
      <div class="card card-pad">
        <div class="field">
          <label>שם הארגון / הקופה המרכזית</label>
          <input type="text" id="setOrgName" value="${esc(s.orgName)}" placeholder="לדוגמה: קרן עזרה וחסד">
        </div>
        <div class="field-row">
          <div class="field">
            <label>מטבע</label>
            <input type="text" id="setCurrency" value="${esc(s.currency)}" maxlength="3">
          </div>
          <div class="field">
            <label>תזכורת אחרי (ימים)</label>
            <input type="number" id="setReminder" value="${s.reminderDays}" min="1">
          </div>
        </div>
        <button class="btn primary block" id="saveSettingsBtn">שמירה</button>
      </div>

      <div class="section-title">מתרימים</div>
      <div class="card">
        ${collectorItems ? `<ul class="list">${collectorItems}</ul>` : `<div class="empty" style="padding:20px"><p>אין עדיין מתרימים</p></div>`}
        <div class="card-pad"><button class="btn block" id="addCollectorBtn">+ הוספת מתרים</button></div>
      </div>

      <div class="section-title">סנכרון בין מכשירים</div>
      <div class="card card-pad">
        <p class="note info">כדי שכל המתרימים יראו את אותם נתונים, אפשר לחבר בסיס נתונים חינמי ב-Supabase. זה שלב אופציונלי — האפליקציה עובדת מצוין גם בלי זה.</p>
        <div class="field mt">
          <label>Supabase URL</label>
          <input type="text" id="cloudUrl" value="${esc(s.cloud.url)}" placeholder="https://xxxx.supabase.co" dir="ltr" style="text-align:left">
        </div>
        <div class="field">
          <label>Supabase anon key</label>
          <input type="text" id="cloudKey" value="${esc(s.cloud.key)}" placeholder="eyJhbGciOi…" dir="ltr" style="text-align:left">
        </div>
        <div class="btn-row">
          <button class="btn block" id="cloudTestBtn">בדיקת חיבור</button>
          <button class="btn primary block" id="cloudSaveBtn">שמירה והפעלה</button>
        </div>
        ${s.cloud.enabled ? `<button class="btn danger sm mt" id="cloudDisableBtn">ניתוק סנכרון</button>` : ''}
      </div>

      <div class="section-title">גיבוי ושחזור</div>
      <div class="card card-pad">
        <p class="dim" style="font-size:.85rem">קובץ אחד עם כל הנתונים — שמרו אותו במקום בטוח (למשל שלחו לעצמכם במייל).</p>
        <p style="font-size:.85rem;margin:8px 0 0">${backupStatusHTML()}</p>
        <div class="btn-row">
          <button class="btn primary block" id="backupExportBtn">ייצוא גיבוי עכשיו</button>
          <button class="btn block" id="backupImportBtn">ייבוא גיבוי</button>
        </div>
        <input type="file" id="backupFile" accept=".json,application/json" class="hidden">
      </div>

      <div class="section-title">אזור מסוכן</div>
      <div class="card card-pad">
        <div class="btn-row">
          <button class="btn block" id="seedDemoBtn">טעינת נתוני דוגמה</button>
          <button class="btn danger block" id="resetAllBtn">איפוס כל הנתונים</button>
        </div>
      </div>

      <p class="dim center" style="font-size:.75rem;margin-top:20px">מכשיר: ${esc(s.deviceName)}</p>
    `;
  }

  function backupStatusHTML() {
    const days = Store.daysSinceBackup();
    if (days === null) return `<span class="pill warn">עדיין לא בוצע גיבוי</span>`;
    if (days === 0) return `<span class="pill ok">גובה גיבוי היום</span>`;
    if (days <= 14) return `<span class="pill ok">גיבוי אחרון: לפני ${days} ימים</span>`;
    return `<span class="pill warn">גיבוי אחרון: לפני ${days} ימים — מומלץ לגבות שוב</span>`;
  }

  function wireSettings(root) {
    const s = Store.data().settings;

    root.querySelector('#saveSettingsBtn').addEventListener('click', () => {
      s.orgName = root.querySelector('#setOrgName').value.trim();
      s.currency = root.querySelector('#setCurrency').value.trim() || '₪';
      s.reminderDays = Number(root.querySelector('#setReminder').value) || 90;
      Store.save();
      UI.toast('ההגדרות נשמרו', 'ok');
    });

    root.querySelectorAll('[data-edit-collector]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Forms.openCollectorForm(Store.collector(btn.dataset.editCollector));
      });
    });
    root.querySelector('#addCollectorBtn').addEventListener('click', () => Forms.openCollectorForm());

    root.querySelector('#cloudTestBtn').addEventListener('click', async () => {
      const url = root.querySelector('#cloudUrl').value.trim();
      const key = root.querySelector('#cloudKey').value.trim();
      if (!url || !key) return UI.toast('נא למלא כתובת ומפתח', 'err');
      try {
        await Sync.testConnection(url, key);
        UI.toast('החיבור תקין ✓', 'ok');
      } catch (e) {
        UI.toast(e.message, 'err');
      }
    });

    root.querySelector('#cloudSaveBtn').addEventListener('click', () => {
      const url = root.querySelector('#cloudUrl').value.trim();
      const key = root.querySelector('#cloudKey').value.trim();
      if (!url || !key) return UI.toast('נא למלא כתובת ומפתח', 'err');
      s.cloud.url = url; s.cloud.key = key; s.cloud.enabled = true;
      Store.save();
      UI.toast('הסנכרון הופעל, מתחיל...', 'ok');
      Sync.syncNow(true);
      App.rerender();
    });

    const disableBtn = root.querySelector('#cloudDisableBtn');
    if (disableBtn) disableBtn.addEventListener('click', () => {
      s.cloud.enabled = false;
      Store.save();
      UI.toast('הסנכרון נותק');
      App.rerender();
    });

    root.querySelector('#backupExportBtn').addEventListener('click', () => {
      const stamp = Store.today();
      downloadFile(`גיבוי-קופות-${stamp}.json`, Store.exportJSON(), 'application/json');
      Store.markBackupExported();
      UI.toast('הגיבוי הורד למכשיר', 'ok');
      App.rerender();
    });
    const fileInput = root.querySelector('#backupFile');
    root.querySelector('#backupImportBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        UI.confirmDialog('ייבוא גיבוי', 'הנתונים הקיימים ימוזגו עם הגיבוי (רשומות עדכניות יותר ינצחו). להמשיך?', () => {
          try {
            Store.importJSON(reader.result, 'merge');
            UI.toast('הייבוא הושלם', 'ok');
            App.rerender();
          } catch (e) {
            UI.toast('קובץ לא תקין: ' + e.message, 'err');
          }
        }, 'ייבוא', false);
      };
      reader.readAsText(file, 'utf-8');
      fileInput.value = '';
    });

    root.querySelector('#seedDemoBtn').addEventListener('click', () => {
      UI.confirmDialog('נתוני דוגמה', 'להוסיף כמה מחזיקים וקופות לדוגמה כדי להתרשם מהמערכת?', () => {
        Store.seedDemo();
        UI.toast('נתוני הדוגמה נוספו', 'ok');
        App.rerender();
      }, 'הוספה', false);
    });

    root.querySelector('#resetAllBtn').addEventListener('click', () => {
      UI.confirmDialog('איפוס כל הנתונים', 'פעולה זו תמחק את כל הקופות, המחזיקים וההיסטוריה במכשיר זה לצמיתות. מומלץ לייצא גיבוי קודם.', () => {
        Store.resetAll();
        UI.toast('כל הנתונים אופסו');
        location.hash = '#/dashboard';
        App.rerender();
      }, 'מחיקה לצמיתות');
    });
  }

  return {
    dashboard, wireDashboard,
    collect, wireCollect,
    boxesView, wireBoxesView,
    boxDetail, wireBoxDetail,
    holderDetail, wireHolderDetail,
    reports, wireReports,
    settings, wireSettings,
    downloadFile
  };
})();
