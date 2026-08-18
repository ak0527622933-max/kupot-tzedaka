/* ==========================================================
   ui.js — רכיבי ממשק כלליים: מודלים, טוסטים, פורמט
   ========================================================== */

const UI = (() => {

  function fmtMoney(n) {
    const cur = Store.data().settings.currency || '₪';
    const v = Number(n) || 0;
    return cur + v.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  }

  function daysLabel(days) {
    if (days === null || days === undefined) return 'מעולם לא נאספה';
    if (days === 0) return 'היום';
    if (days === 1) return 'אתמול';
    return `לפני ${days.toLocaleString('he-IL')} ימים`;
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  }

  function esc(s) {
    const div = document.createElement('div');
    div.textContent = s === null || s === undefined ? '' : String(s);
    return div.innerHTML;
  }

  /* ---------- Toast ---------- */

  function toast(msg, kind = '') {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  /* ---------- Modal ---------- */

  let currentClose = null;

  function openModal(innerHTML, opts = {}) {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal">
      <div class="modal-grip"></div>
      ${innerHTML}
    </div>`;
    if (!opts.persistent) {
      backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    }
    document.getElementById('modalRoot').appendChild(backdrop);
    currentClose = () => backdrop.remove();
    return backdrop;
  }

  function closeModal() {
    if (currentClose) { currentClose(); currentClose = null; }
  }

  /** מודל אישור פעולה הרסנית */
  function confirmDialog(title, msg, onConfirm, confirmLabel = 'אישור', danger = true) {
    const el = openModal(`
      <h2>${esc(title)}</h2>
      <p class="modal-sub">${esc(msg)}</p>
      <div class="btn-row">
        <button class="btn block" id="cd-cancel">ביטול</button>
        <button class="btn block ${danger ? 'danger' : 'primary'}" id="cd-ok">${esc(confirmLabel)}</button>
      </div>
    `);
    el.querySelector('#cd-cancel').onclick = closeModal;
    el.querySelector('#cd-ok').onclick = () => { closeModal(); onConfirm(); };
  }

  /* ---------- Sync badge ---------- */

  function updateSyncBadge(status) {
    const el = document.getElementById('syncBadge');
    if (!el) return;
    el.classList.remove('err', 'ok');
    switch (status) {
      case 'off': el.textContent = 'מקומי'; break;
      case 'syncing': el.textContent = 'מסנכרן…'; break;
      case 'ok': el.textContent = 'מסונכרן'; el.classList.add('ok'); break;
      case 'err': el.textContent = 'שגיאת סנכרון'; el.classList.add('err'); break;
      default: el.textContent = '';
    }
  }

  return { fmtMoney, fmtDate, fmtDateShort, daysLabel, initials, esc, toast, openModal, closeModal, confirmDialog, updateSyncBadge };
})();
