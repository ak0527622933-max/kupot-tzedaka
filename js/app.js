/* ==========================================================
   app.js — ראוטר ראשי ואתחול
   ========================================================== */

const App = (() => {
  const view = document.getElementById('view');
  const pageTitle = document.getElementById('pageTitle');
  const backBtn = document.getElementById('backBtn');

  const ROUTES = {
    dashboard:     { title: 'לוח בקרה',   tab: 'dashboard' },
    collect:       { title: 'רישום אסיפה', tab: 'collect', back: true },
    boxes:         { title: 'קופות',       tab: 'boxes' },
    'box-detail':  { title: 'קופה',        tab: 'boxes', back: true },
    'holder-detail': { title: 'מחזיק',     tab: 'boxes', back: true },
    reports:       { title: 'דוחות',       tab: 'reports' },
    settings:      { title: 'הגדרות',      tab: 'settings' }
  };

  let route = { name: 'dashboard', params: {} };

  function parseHash() {
    const raw = (location.hash || '#/dashboard').slice(2); // strip "#/"
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = {};
    if (queryPart) queryPart.split('&').forEach(kv => {
      const [k, v] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });

    if (parts.length === 0 || parts[0] === 'dashboard') return { name: 'dashboard', params: {}, query };
    if (parts[0] === 'collect') return { name: 'collect', params: {}, query };
    if (parts[0] === 'reports') return { name: 'reports', params: {}, query };
    if (parts[0] === 'settings') return { name: 'settings', params: {}, query };
    if (parts[0] === 'boxes' && parts[1]) return { name: 'box-detail', params: { id: parts[1] }, query };
    if (parts[0] === 'boxes') return { name: 'boxes', params: {}, query };
    if (parts[0] === 'holders' && parts[1]) return { name: 'holder-detail', params: { id: parts[1] }, query };
    return { name: 'dashboard', params: {}, query };
  }

  function currentRoute() { return route; }

  function render() {
    route = parseHash();
    const meta = ROUTES[route.name] || ROUTES.dashboard;

    pageTitle.textContent = meta.title;
    backBtn.classList.toggle('hidden', !meta.back);

    let html = '';
    switch (route.name) {
      case 'dashboard': html = Views.dashboard(); break;
      case 'collect': html = Views.collect(); break;
      case 'boxes': html = Views.boxesView(route.query); break;
      case 'box-detail': html = Views.boxDetail(route.params.id); break;
      case 'holder-detail': html = Views.holderDetail(route.params.id); break;
      case 'reports': html = Views.reports(); break;
      case 'settings': html = Views.settings(); break;
    }
    view.innerHTML = html;
    view.scrollTop = 0;
    window.scrollTo(0, 0);

    switch (route.name) {
      case 'dashboard': Views.wireDashboard(view); break;
      case 'collect': Views.wireCollect(view); break;
      case 'boxes': Views.wireBoxesView(view, route.query); break;
      case 'box-detail': Views.wireBoxDetail(view, route.params.id); break;
      case 'holder-detail': Views.wireHolderDetail(view, route.params.id); break;
      case 'reports': Views.wireReports(view); break;
      case 'settings': Views.wireSettings(view); break;
    }

    document.querySelectorAll('#tabbar a').forEach(a => {
      a.classList.toggle('on', a.dataset.tab === meta.tab);
    });
  }

  function rerender() { render(); }

  function init() {
    Store.load();
    Sync.init();
    window.addEventListener('hashchange', render);
    backBtn.addEventListener('click', () => history.back());
    render();
    UI.updateSyncBadge(Sync.getStatus());
    registerServiceWorker();

    // בנייד, כשהאפליקציה עוברת לרקע, הדפדפן משהה טיימרים (כולל בדיקת
    // הסנכרון כל דקה). לכן מסנכרנים שוב באופן יזום בכל פעם שחוזרים
    // למסך — אחרת רואים נתונים ישנים עד שרעננים ידנית
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Sync.isConfigured()) {
        Sync.syncNow(false);
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { init, render, rerender, currentRoute };
})();

document.addEventListener('DOMContentLoaded', App.init);
