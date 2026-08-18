/* ==========================================================
   forms.js — טפסים מודליים ליצירה/עריכה
   ========================================================== */

const Forms = (() => {
  const { esc } = UI;

  function holderOptions(selectedId) {
    return Store.holders()
      .slice().sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map(h => `<option value="${h.id}" ${h.id === selectedId ? 'selected' : ''}>${esc(h.name)}</option>`)
      .join('');
  }

  function collectorOptions(selectedId) {
    return Store.collectors()
      .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`)
      .join('');
  }

  /* ---------- מחזיק ---------- */

  function openHolderForm(existing, onSaved) {
    const el = UI.openModal(`
      <h2>${existing ? 'עריכת מחזיק' : 'מחזיק חדש'}</h2>
      <div class="field">
        <label>שם *</label>
        <input type="text" id="fName" value="${existing ? esc(existing.name) : ''}" placeholder="לדוגמה: משפחת כהן">
      </div>
      <div class="field">
        <label>טלפון</label>
        <input type="tel" id="fPhone" value="${existing ? esc(existing.phone) : ''}" dir="ltr" style="text-align:right">
      </div>
      <div class="field">
        <label>כתובת</label>
        <input type="text" id="fAddress" value="${existing ? esc(existing.address) : ''}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>עיר</label>
          <input type="text" id="fCity" value="${existing ? esc(existing.city) : ''}">
        </div>
        <div class="field">
          <label>אזור / מסלול</label>
          <input type="text" id="fArea" value="${existing ? esc(existing.area) : ''}">
        </div>
      </div>
      <div class="field">
        <label>הערות</label>
        <textarea id="fNotes" placeholder="לדוגמה: קומה ב', לצלצל לפני הגעה">${existing ? esc(existing.notes) : ''}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn block" id="fCancel">ביטול</button>
        <button class="btn primary block" id="fSave">שמירה</button>
      </div>
    `);
    el.querySelector('#fCancel').onclick = UI.closeModal;
    el.querySelector('#fName').focus();
    el.querySelector('#fSave').onclick = () => {
      const name = el.querySelector('#fName').value.trim();
      if (!name) return UI.toast('נא להזין שם', 'err');
      const h = Store.saveHolder({
        id: existing ? existing.id : null,
        name,
        phone: el.querySelector('#fPhone').value,
        address: el.querySelector('#fAddress').value,
        city: el.querySelector('#fCity').value,
        area: el.querySelector('#fArea').value,
        notes: el.querySelector('#fNotes').value
      });
      UI.closeModal();
      UI.toast(existing ? 'העדכון נשמר' : 'המחזיק נוסף', 'ok');
      if (onSaved) { onSaved(h); return; }
      const r = App.currentRoute();
      if (r && (r.name === 'holder-detail' || r.name === 'boxes')) App.rerender();
    };
  }

  /* ---------- קופה ---------- */

  function openBoxForm(existing, presetHolderId) {
    const holderId = existing ? existing.holder_id : presetHolderId;
    const el = UI.openModal(`
      <h2>${existing ? 'עריכת קופה' : 'קופה חדשה'}</h2>
      <div class="field">
        <label>מספר סידורי *</label>
        <input type="text" id="fSerial" value="${existing ? esc(existing.serial) : ''}" placeholder="לדוגמה: ק-101">
      </div>
      <div class="field">
        <label>מחזיק</label>
        <select id="fHolder">
          <option value="">— ללא מחזיק —</option>
          ${holderOptions(holderId)}
        </select>
        <div class="hint">אין את המחזיק ברשימה? <a class="plain" href="#" id="fNewHolder">הוספת מחזיק חדש</a></div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>סוג קופה</label>
          <input type="text" id="fType" value="${existing ? esc(existing.type) : 'רגילה'}">
        </div>
        <div class="field">
          <label>תאריך הצבה</label>
          <input type="date" id="fPlaced" value="${existing && existing.placed_date ? existing.placed_date : Store.today()}">
        </div>
      </div>
      <div class="field">
        <label>הערות</label>
        <textarea id="fNotes">${existing ? esc(existing.notes) : ''}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn block" id="fCancel">ביטול</button>
        <button class="btn primary block" id="fSave">שמירה</button>
      </div>
    `);
    el.querySelector('#fCancel').onclick = UI.closeModal;
    el.querySelector('#fSerial').focus();
    el.querySelector('#fNewHolder').onclick = (e) => {
      e.preventDefault();
      openHolderForm();
    };
    el.querySelector('#fSave').onclick = () => {
      const serial = el.querySelector('#fSerial').value.trim();
      if (!serial) return UI.toast('נא להזין מספר סידורי', 'err');
      if (Store.serialTaken(serial, existing ? existing.id : null)) {
        return UI.toast('מספר קופה זה כבר קיים', 'err');
      }
      const holder_id = el.querySelector('#fHolder').value || null;
      Store.saveBox({
        id: existing ? existing.id : null,
        serial,
        holder_id,
        status: holder_id ? 'placed' : 'available',
        type: el.querySelector('#fType').value,
        placed_date: el.querySelector('#fPlaced').value,
        notes: el.querySelector('#fNotes').value
      });
      UI.closeModal();
      UI.toast(existing ? 'העדכון נשמר' : 'הקופה נוספה', 'ok');
      App.rerender();
    };
  }

  /* ---------- מתרים ---------- */

  function openCollectorForm(existing) {
    const el = UI.openModal(`
      <h2>${existing ? 'עריכת מתרים' : 'מתרים חדש'}</h2>
      <div class="field">
        <label>שם *</label>
        <input type="text" id="fName" value="${existing ? esc(existing.name) : ''}">
      </div>
      <div class="field">
        <label>טלפון</label>
        <input type="tel" id="fPhone" value="${existing ? esc(existing.phone) : ''}" dir="ltr" style="text-align:right">
      </div>
      <div class="btn-row">
        <button class="btn block" id="fCancel">ביטול</button>
        <button class="btn primary block" id="fSave">שמירה</button>
      </div>
      ${existing ? `<button class="btn danger block mt" id="fDelete">מחיקת מתרים</button>` : ''}
    `);
    el.querySelector('#fCancel').onclick = UI.closeModal;
    el.querySelector('#fName').focus();
    el.querySelector('#fSave').onclick = () => {
      const name = el.querySelector('#fName').value.trim();
      if (!name) return UI.toast('נא להזין שם', 'err');
      Store.saveCollector({
        id: existing ? existing.id : null,
        name,
        phone: el.querySelector('#fPhone').value
      });
      UI.closeModal();
      UI.toast(existing ? 'העדכון נשמר' : 'המתרים נוסף', 'ok');
      App.rerender();
    };
    const delBtn = el.querySelector('#fDelete');
    if (delBtn) delBtn.onclick = () => {
      UI.confirmDialog('מחיקת מתרים', `למחוק את ${existing.name}?`, () => {
        Store.deleteCollector(existing.id);
        UI.closeModal();
        UI.toast('המתרים נמחק');
        App.rerender();
      });
    };
  }

  /* ---------- רישום אסיפה ---------- */

  function openCollectionForm(boxId) {
    const b = Store.box(boxId);
    if (!b) return;
    const h = b.holder_id ? Store.holder(b.holder_id) : null;
    const collectors = Store.collectors();

    const el = UI.openModal(`
      <h2>רישום אסיפה</h2>
      <p class="modal-sub">${esc(b.serial)}${h ? ' · ' + esc(h.name) : ''}</p>

      <div class="field">
        <label>מה קרה בביקור?</label>
        <div class="chips" id="outcomeChips">
          <div class="chip on" data-v="collected">נאסף כסף</div>
          <div class="chip" data-v="no_answer">לא היו בבית</div>
          <div class="chip" data-v="refused">סירבו</div>
          <div class="chip" data-v="empty">קופה ריקה</div>
        </div>
      </div>

      <div class="field amount-input" id="amountWrap">
        <label>סכום</label>
        <input type="number" id="fAmount" inputmode="decimal" placeholder="0" min="0">
      </div>

      <div class="field" id="collectorWrap">
        <label>מתרים</label>
        <select id="fCollector">
          <option value="">— לא צוין —</option>
          ${collectorOptions(null)}
        </select>
      </div>

      <div class="field">
        <label>תאריך</label>
        <input type="date" id="fDate" value="${Store.today()}">
      </div>

      <div class="field">
        <label>הערות</label>
        <textarea id="fNotes" placeholder="אופציונלי"></textarea>
      </div>

      <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;margin-bottom:14px" id="receiptWrap">
        <input type="checkbox" id="fReceipt" style="width:18px;height:18px">
        <span>הנפקת קבלה למחזיק</span>
      </label>

      <div class="btn-row">
        <button class="btn block" id="fCancel">ביטול</button>
        <button class="btn primary block" id="fSave">שמירה</button>
      </div>
    `);

    let outcome = 'collected';
    const amountWrap = el.querySelector('#amountWrap');
    const collectorWrap = el.querySelector('#collectorWrap');
    const receiptWrap = el.querySelector('#receiptWrap');

    function syncVisibility() {
      const isMoney = outcome === 'collected';
      amountWrap.style.display = isMoney ? '' : 'none';
      collectorWrap.style.display = isMoney ? '' : 'none';
      receiptWrap.style.display = isMoney ? '' : 'none';
    }
    syncVisibility();

    el.querySelectorAll('#outcomeChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        outcome = chip.dataset.v;
        el.querySelectorAll('#outcomeChips .chip').forEach(c => c.classList.toggle('on', c === chip));
        syncVisibility();
      });
    });

    el.querySelector('#fCancel').onclick = UI.closeModal;
    if (outcome === 'collected') setTimeout(() => el.querySelector('#fAmount').focus(), 50);

    el.querySelector('#fSave').onclick = () => {
      const amount = Number(el.querySelector('#fAmount').value) || 0;
      if (outcome === 'collected' && amount <= 0) {
        return UI.toast('נא להזין סכום גדול מ-0', 'err');
      }
      Store.saveCollection({
        box_id: boxId,
        collector_id: el.querySelector('#fCollector').value || null,
        date: el.querySelector('#fDate').value || Store.today(),
        amount: outcome === 'collected' ? amount : 0,
        outcome,
        notes: el.querySelector('#fNotes').value,
        issueReceipt: outcome === 'collected' && el.querySelector('#fReceipt').checked
      });
      UI.closeModal();
      UI.toast('האסיפה נרשמה', 'ok');
      location.hash = '#/boxes/' + boxId;
      App.rerender();
    };
  }

  return { openHolderForm, openBoxForm, openCollectorForm, openCollectionForm };
})();
