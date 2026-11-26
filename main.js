import { h, clear, dateKey } from './utils.js';
import { createStore, makeAction, STORAGE_KEY } from './store.js';
import { remaining } from './timer.js';
import { createToaster, createTaskDialog, icon } from './ui.js';
import { todayView, tasksView, focusView, statsView, settingsView } from './views.js';

const store = createStore(localStorage);
const ROUTES = [
  { id: 'today', label: 'اليوم', make: todayView }, { id: 'tasks', label: 'المهام', make: tasksView },
  { id: 'focus', label: 'تركيز', make: focusView }, { id: 'stats', label: 'إحصائيات', make: statsView },
  { id: 'settings', label: 'إعدادات', make: settingsView },
];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---- shell -------------------------------------------------------------------
const toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
const toast = createToaster(toastHost);
const main = h('main', { id: 'main', tabindex: '-1' });
const nav = h('nav', { class: 'nav', 'aria-label': 'التنقل الرئيسي' },
  h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, icon('check', 20)), h('strong', null, 'منجز')),
  ROUTES.map((r) => h('a', { href: `#/${r.id}`, class: 'nav-link', dataset: { route: r.id } }, icon(r.id), h('span', null, r.label))));
document.getElementById('app').replaceChildren(h('a', { class: 'skip', href: '#main' }, 'تخطّي للمحتوى'), h('div', { class: 'aura', 'aria-hidden': 'true' }), nav, main, toastHost);

// ---- context shared with views ------------------------------------------------
let deferredInstall = null, storageMsg = '';
const ctx = {
  store, dispatch: store.dispatch, toast, make: makeAction,
  vibrate: (p) => { if (store.get().settings.vibrate && navigator.vibrate) navigator.vibrate(p); },
  refresh: () => current && current.view.update(store.get()),
  editTask: (id) => dialog.open(id ? store.get().tasks.find((t) => t.id === id) : null),
  removeTask(id) {
    const s = store.get(), index = s.tasks.findIndex((t) => t.id === id); if (index < 0) return;
    const task = s.tasks[index]; store.dispatch({ type: 'task/remove', id }); ctx.vibrate(20);
    toast('اتحذفت المهمة', { label: 'تراجع', run: () => store.dispatch({ type: 'task/restore', task, index }) });
  },
  toggleTimer() { unlockAudio(); const t = store.get().timer; store.dispatch(makeAction.timer(t.status === 'running' ? 'pause' : 'start')); ctx.vibrate(10); },
  canInstall: () => !!deferredInstall,
  async install() { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; ctx.refresh(); },
  storageNote: () => storageMsg,
  exportData() {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `monjez-${dateKey()}.json` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  confirmReset() {
    const d = h('dialog', { class: 'sheet small' }, h('form', { method: 'dialog' }, h('h2', null, 'مسح كل البيانات؟'), h('p', { class: 'muted' }, 'المهام والجلسات والإعدادات هتتمسح من الجهاز ده. مفيش تراجع.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn danger-fill', value: 'ok' }, 'امسح'), h('button', { class: 'btn ghost', value: 'no' }, 'إلغاء'))));
    d.addEventListener('close', () => { if (d.returnValue === 'ok') { store.dispatch({ type: 'data/reset' }); toast('اتمسح كل حاجة'); } d.remove(); });
    document.body.append(d); d.showModal();
  },
};
const dialog = createTaskDialog(ctx); document.body.append(dialog.el);

// ---- router --------------------------------------------------------------------
let current = null;
function route() {
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const def = ROUTES.find((r) => r.id === id) || ROUTES[0];
  if (current && current.id === def.id) return;
  const swap = () => {
    current?.view.destroy?.(); unsub?.();
    const view = def.make(ctx); current = { id: def.id, view };
    clear(main).append(view.el); view.update(store.get()); view.mount?.();
    unsub = store.subscribe((s) => view.update(s));
    nav.querySelectorAll('.nav-link').forEach((a) => { const on = a.dataset.route === def.id; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  };
  if (document.startViewTransition && !reduceMotion.matches && current) document.startViewTransition(swap); else swap();
}
let unsub = null;
addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); });

// ---- theme ---------------------------------------------------------------------
const applyTheme = (s) => {
  const t = s.settings.theme; const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#0b1020' : '#f6f3ec');
};
store.subscribe(applyTheme); applyTheme(store.get());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(store.get()));

// ---- timer completion (works on every view) -------------------------------------
let audio = null;
function unlockAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.state === 'suspended' && audio.resume(); } catch { /* no audio */ } }
function chime() {
  if (!audio || !store.get().settings.sound) return;
  [659, 880, 1175].forEach((f, i) => { const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.16;
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.55); });
}
setInterval(() => {
  const t = store.get().timer;
  if (t.status === 'running' && remaining(t, Date.now()) <= 0) {
    const wasFocus = t.phase === 'focus';
    store.dispatch(makeAction.timer('complete')); chime(); ctx.vibrate([200, 100, 200, 100, 400]);
    toast(wasFocus ? 'خلصت جلسة تركيز. خد راحة.' : 'الراحة خلصت. نكمّل؟');
  }
}, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wakeSync(); } else store.flush(); });
addEventListener('pagehide', () => store.flush());
document.addEventListener('pointerdown', unlockAudio, { once: true });

// keep the screen awake while a focus session runs
let lock = null;
async function wakeSync() {
  const run = store.get().timer.status === 'running';
  try {
    if (run && !lock && 'wakeLock' in navigator && !document.hidden) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    else if (!run && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
store.subscribe(wakeSync);

// ---- keyboard shortcuts -----------------------------------------------------------
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  const idx = '12345'.indexOf(e.key); if (idx >= 0) { location.hash = `#/${ROUTES[idx].id}`; return; }
  if (e.key === 'n') { e.preventDefault(); ctx.editTask(null); }
  if (current?.id === 'focus' && e.code === 'Space' && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); ctx.toggleTimer(); }
  if (current?.id === 'focus' && e.key === 'r') store.dispatch(makeAction.timer('reset'));
});

// ---- PWA ---------------------------------------------------------------------------
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; ctx.refresh(); });
addEventListener('appinstalled', () => { deferredInstall = null; toast('اتثبّت التطبيق'); });
if (navigator.storage?.persist) navigator.storage.persist().then((ok) => { storageMsg = ok ? 'التخزين محمي من المسح التلقائي.' : ''; ctx.refresh(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) toast('في نسخة جديدة', { label: 'حدّث', run: () => w.postMessage('SKIP_WAITING') }); }); });
  }).catch(() => {});
  let reloading = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}
route(); wakeSync();
