// Each view: build static skeleton once, then update(state) patches what changed.
import { h, svg, n, clear, dateKey, addDays, longDate, weekdayShort, minutesLabel, mmss } from './utils.js';
import { SUBJECTS, subjectColor, subjectOf, visibleTasks, minutesByDay, lastDays, streak, subjectTotals, keyOfTs, makeAction, STORAGE_KEY } from './store.js';
import { remaining, progress } from './timer.js';
import { icon, ring, taskRow, emptyState, segmented } from './ui.js';

const greeting = () => { const hr = new Date().getHours(); return hr < 5 || hr >= 19 ? 'مساء الخير' : hr < 12 ? 'صباح الخير' : 'نهارك جميل'; };
const header = (title, sub) => h('header', { class: 'view-head' }, h('h1', null, title), sub && h('p', { class: 'sub' }, sub));

function taskList(ctx) {
  const ul = h('ul', { class: 'tasks', role: 'list' });
  let sig = '';
  return { el: ul, render(tasks, today, empty, extra = '') {
    const s = JSON.stringify(tasks) + today + extra; if (s === sig) return; sig = s;
    clear(ul);
    if (!tasks.length) { ul.append(h('li', { class: 'empty-li' }, empty)); return; }
    tasks.forEach((t) => ul.append(taskRow(t, ctx, today)));
  } };
}

// ---- Today ------------------------------------------------------------------
export function todayView(ctx) {
  const goalRing = ring({ size: 132, stroke: 12, label: 'هدف اليوم' });
  const big = h('div', { class: 'big' }), small = h('div', { class: 'muted' }), flame = h('span', { class: 'chip flame' });
  const list = taskList(ctx);
  const input = h('input', { type: 'text', placeholder: 'اكتب مهمة وخلّيها تتسجل…', 'aria-label': 'مهمة سريعة', autocomplete: 'off', maxLength: 200 });
  const quick = h('form', { class: 'quick', onsubmit: (e) => { e.preventDefault(); if (!input.value.trim()) return; ctx.dispatch(makeAction.addTask({ title: input.value, due: dateKey() })); input.value = ''; ctx.vibrate(10); } },
    input, h('button', { class: 'btn primary icon-only', type: 'submit', 'aria-label': 'إضافة' }, icon('plus')));
  const doneNote = h('p', { class: 'muted note' });
  const el = h('section', { class: 'view' }, header(greeting(), longDate(dateKey())),
    h('div', { class: 'card hero' }, h('div', { class: 'ring-wrap' }, goalRing.el, h('div', { class: 'ring-center' }, big)),
      h('div', { class: 'hero-text' }, h('h2', null, 'هدف التركيز'), small, flame,
        h('a', { class: 'btn primary', href: '#/focus' }, icon('play', 18), 'ابدأ جلسة تركيز'))),
    quick, h('h2', { class: 'section-title' }, 'مهام النهاردة'), list.el, doneNote);
  return { el, update(s) {
    const today = dateKey(), mins = minutesByDay(s, [today])[0], goal = s.settings.goal;
    goalRing.set(mins / goal, `${n(mins)} من ${n(goal)} دقيقة`);
    big.textContent = `${n(Math.min(100, mins / goal * 100))}٪`;
    small.textContent = `${minutesLabel(mins)} من ${minutesLabel(goal)}`;
    const st = streak(s, today); flame.replaceChildren(icon('flame', 16), st ? `${n(st)} يوم متتالي` : 'ابدأ سلسلتك النهاردة');
    list.render(visibleTasks(s, 'today', '', today), today, emptyState('مفيش مهام النهاردة', 'اكتب مهمة فوق أو ارتاح، انت كده ماشي تمام.'));
    const doneToday = s.tasks.filter((t) => t.doneAt && keyOfTs(t.doneAt) === today).length;
    doneNote.textContent = doneToday ? `خلّصت ${n(doneToday)} مهمة النهاردة. عاش.` : '';
  } };
}

// ---- Tasks ------------------------------------------------------------------
export function tasksView(ctx) {
  let filter = 'all', query = '';
  const list = taskList(ctx);
  const search = h('input', { type: 'search', placeholder: 'دوّر في المهام', 'aria-label': 'بحث', oninput: (e) => { query = e.target.value; ctx.refresh(); } });
  const tabs = [['all', 'الكل'], ['today', 'النهاردة'], ['upcoming', 'جاية'], ['done', 'خلصانة']];
  const seg = segmented({ label: 'تصفية', value: 'all', options: tabs.map(([value, label]) => ({ value, label })), onChange: (v) => { filter = v; ctx.refresh(); } });
  const count = h('p', { class: 'muted note', 'aria-live': 'polite' });
  const el = h('section', { class: 'view' }, header('المهام', 'اسحب المهمة على جنب لحذفها، وتقدر ترجّعها.'), search, seg, list.el, count,
    h('button', { class: 'fab', type: 'button', 'aria-label': 'مهمة جديدة', onclick: () => ctx.editTask(null) }, icon('plus', 26)));
  return { el, update(s) {
    const today = dateKey(), items = visibleTasks(s, filter, query, today);
    list.render(items, today, emptyState(query ? 'مفيش نتيجة' : 'القائمة فاضية', query ? 'جرّب كلمة تانية.' : 'دوس + وضيف أول مهمة.'), filter + query);
    const open = s.tasks.filter((t) => !t.done).length;
    count.textContent = `${n(open)} مهمة مفتوحة من ${n(s.tasks.length)}`;
  } };
}

// ---- Focus ------------------------------------------------------------------
const PHASES = { focus: 'تركيز', short: 'راحة قصيرة', long: 'راحة طويلة' };
export function focusView(ctx) {
  const r = ring({ size: 280, stroke: 14, label: 'المؤقت' });
  const time = h('div', { class: 'time', role: 'timer', 'aria-live': 'off' }), phaseLbl = h('div', { class: 'phase' });
  const seg = segmented({ label: 'نوع الجلسة', value: 'focus', options: Object.entries(PHASES).map(([value, label]) => ({ value, label })), onChange: (v) => ctx.dispatch(makeAction.timer('phase', { phase: v })) });
  const subj = h('select', { 'aria-label': 'المادة', onchange: (e) => ctx.dispatch(makeAction.timer('target', { subject: e.target.value })) }, SUBJECTS.map((s) => h('option', { value: s.id }, s.name)));
  const taskSel = h('select', { 'aria-label': 'المهمة', onchange: (e) => ctx.dispatch(makeAction.timer('target', { taskId: e.target.value || null })) });
  const playBtn = h('button', { class: 'btn primary big-btn', type: 'button', onclick: () => ctx.toggleTimer() });
  const resetBtn = h('button', { class: 'icon-btn round', type: 'button', 'aria-label': 'إعادة', onclick: () => ctx.dispatch(makeAction.timer('reset')) }, icon('reset'));
  const skipBtn = h('button', { class: 'icon-btn round', type: 'button', 'aria-label': 'تخطي', onclick: () => ctx.dispatch(makeAction.timer('skip')) }, icon('skip'));
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('i')));
  const todayNote = h('p', { class: 'muted note' });
  const hint = h('p', { class: 'muted note hint' }, 'مسافة للتشغيل والإيقاف • R للإعادة');
  const el = h('section', { class: 'view focus' }, header('التركيز'), seg,
    h('div', { class: 'dial' }, r.el, h('div', { class: 'dial-center' }, phaseLbl, time)),
    h('div', { class: 'controls' }, resetBtn, playBtn, skipBtn), dots,
    h('div', { class: 'row2 pick' }, subj, taskSel), todayNote, hint);
  let last = null;
  function tick() {
    const t = ctx.store.get().timer, now = Date.now();
    const rem = remaining(t, now);
    time.textContent = mmss(rem); r.set(progress(t, now));
    if (t.status === 'running') document.title = `${mmss(rem)} • منجز`;
  }
  let iv;
  return { el, mount() { iv = setInterval(tick, 250); }, destroy() { clearInterval(iv); document.title = 'منجز'; }, update(s) {
    const t = s.timer;
    el.dataset.phase = t.phase; el.dataset.status = t.status;
    seg.set(t.phase); phaseLbl.textContent = PHASES[t.phase];
    playBtn.replaceChildren(icon(t.status === 'running' ? 'pause' : 'play', 24), t.status === 'running' ? 'إيقاف مؤقت' : t.status === 'paused' ? 'كمّل' : 'ابدأ');
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < t.cycle % 4 || (t.cycle > 0 && t.cycle % 4 === 0 && t.phase === 'long')));
    subj.value = t.subject;
    const sig = JSON.stringify(s.tasks.filter((x) => !x.done).map((x) => [x.id, x.title])) + t.taskId;
    if (sig !== last) { last = sig; taskSel.replaceChildren(h('option', { value: '' }, 'من غير مهمة محددة'), ...s.tasks.filter((x) => !x.done).map((x) => h('option', { value: x.id }, x.title))); taskSel.value = t.taskId || ''; }
    const today = dateKey(); const todays = s.sessions.filter((x) => keyOfTs(x.ts) === today);
    todayNote.textContent = todays.length ? `النهاردة: ${n(todays.length)} جلسة • ${minutesLabel(todays.reduce((a, b) => a + b.minutes, 0))}` : 'لسه مفيش جلسات النهاردة.';
    tick();
  } };
}

// ---- Stats ------------------------------------------------------------------
export function statsView(ctx) {
  const cards = h('div', { class: 'stat-grid' });
  const chartBox = h('div', { class: 'card chart' }), subjBox = h('div', { class: 'card' }), heatBox = h('div', { class: 'card' });
  const el = h('section', { class: 'view' }, header('إحصائيات', 'شوف تقدّمك بالأرقام.'), cards,
    h('h2', { class: 'section-title' }, 'آخر ٧ أيام'), chartBox, h('h2', { class: 'section-title' }, 'حسب المادة (٣٠ يوم)'), subjBox,
    h('h2', { class: 'section-title' }, 'خريطة الالتزام'), heatBox);
  const stat = (label, value, hint) => h('div', { class: 'card stat' }, h('span', { class: 'muted' }, label), h('strong', null, value), hint && h('small', { class: 'muted' }, hint));
  return { el, update(s) {
    const today = dateKey(), days = lastDays(today, 7), mins = minutesByDay(s, days), goal = s.settings.goal;
    const total = mins.reduce((a, b) => a + b, 0), best = Math.max(...mins);
    const wk = days[0], doneWk = s.tasks.filter((t) => t.doneAt && keyOfTs(t.doneAt) >= wk).length;
    clear(cards).append(stat('تركيز الأسبوع', minutesLabel(total), `متوسط ${minutesLabel(total / 7)} باليوم`), stat('مهام خلصت', n(doneWk), 'آخر ٧ أيام'),
      stat('سلسلة الأيام', `${n(streak(s, today))} يوم`), stat('أحسن يوم', minutesLabel(best)));
    // bar chart
    const W = 340, H = 170, pad = 24, bw = 28, gap = (W - pad * 2 - bw * 7) / 6, max = Math.max(goal, ...mins, 1), ch = H - 44;
    const bars = days.map((k, i) => { const v = mins[i], bh = Math.max(v ? 4 : 0, v / max * ch), x = pad + i * (bw + gap);
      return svg('g', null, svg('rect', { x, y: 8 + ch - bh, width: bw, height: bh, rx: 8, class: `bar${k === today ? ' today' : ''}${v >= goal ? ' hit' : ''}` }, svg('title', null, `${weekdayShort(k)}: ${minutesLabel(v)}`)),
        svg('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, weekdayShort(k))); });
    const gy = 8 + ch - goal / max * ch;
    clear(chartBox).append(svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `تركيز آخر ٧ أيام: ${mins.map((m, i) => `${weekdayShort(days[i])} ${minutesLabel(m)}`).join('، ')}` },
      svg('line', { x1: 8, x2: W - 8, y1: gy, y2: gy, class: 'goal-line' }), ...bars));
    // subjects
    const tot = subjectTotals(s, addDays(today, -29)), mx = tot[0]?.minutes || 1;
    clear(subjBox).append(...(tot.length ? tot.map((t) => h('div', { class: 'hbar' }, h('span', null, subjectOf(t.id).name), h('div', { class: 'hbar-track' }, h('i', { style: { width: `${t.minutes / mx * 100}%`, '--c': subjectColor(t.id) } })), h('b', null, minutesLabel(t.minutes)))) : [h('p', { class: 'muted' }, 'أول جلسة تركيز هتظهر هنا.')]));
    // heatmap 5 weeks
    const hd = lastDays(today, 35), hm = minutesByDay(s, hd);
    clear(heatBox).append(h('div', { class: 'heat', role: 'img', 'aria-label': 'خريطة ٣٥ يوم' }, hd.map((k, i) => { const lv = hm[i] === 0 ? 0 : hm[i] < goal * .5 ? 1 : hm[i] < goal ? 2 : 3; return h('i', { class: `l${lv}${k === today ? ' now' : ''}`, title: `${longDate(k)}: ${minutesLabel(hm[i])}` }); })),
      h('div', { class: 'legend muted' }, 'أقل', h('i', { class: 'l0' }), h('i', { class: 'l1' }), h('i', { class: 'l2' }), h('i', { class: 'l3' }), 'أكتر'));
  } };
}

// ---- Settings ---------------------------------------------------------------
export function settingsView(ctx) {
  const stepper = (key, label, lo, hi, step = 1, unit = 'دقيقة') => {
    const val = h('output', { 'aria-live': 'polite' });
    const set = (d) => { const cur = ctx.store.get().settings[key]; ctx.dispatch({ type: 'settings', patch: { [key]: Math.min(hi, Math.max(lo, cur + d * step)) } }); };
    return { key, val, el: h('div', { class: 'setting' }, h('span', null, label), h('div', { class: 'stepper' }, h('button', { class: 'icon-btn round', type: 'button', 'aria-label': `زوّد ${label}`, onclick: () => set(1) }, icon('plus', 18)), val, h('button', { class: 'icon-btn round', type: 'button', 'aria-label': `قلّل ${label}`, onclick: () => set(-1) }, svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg('path', { d: 'M5 12h14' }))))), unit };
  };
  const steps = [stepper('focus', 'مدة التركيز', 5, 120, 5), stepper('short', 'راحة قصيرة', 1, 30), stepper('long', 'راحة طويلة', 5, 60, 5), stepper('goal', 'هدف اليوم', 15, 600, 15)];
  const toggle = (key, label) => { const b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-label': label, onclick: () => ctx.dispatch({ type: 'settings', patch: { [key]: !ctx.store.get().settings[key] } }) }, h('i')); return { key, b, el: h('div', { class: 'setting' }, h('span', null, label), b) }; };
  const toggles = [toggle('sound', 'صوت عند انتهاء الجلسة'), toggle('vibrate', 'اهتزاز')];
  const theme = segmented({ label: 'المظهر', value: 'auto', options: [{ value: 'auto', label: 'تلقائي' }, { value: 'dark', label: 'داكن' }, { value: 'light', label: 'فاتح' }], onChange: (v) => ctx.dispatch({ type: 'settings', patch: { theme: v } }) });
  const file = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const data = JSON.parse(await f.text()); if (!data || !Array.isArray(data.tasks)) throw new Error('shape'); ctx.dispatch({ type: 'data/replace', state: data }); ctx.toast('اتسترجعت البيانات'); } catch { ctx.toast('الملف مش صالح'); }
  } });
  const install = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => ctx.install() }, 'ثبّت التطبيق على الشاشة');
  const storageNote = h('p', { class: 'muted note' });
  const el = h('section', { class: 'view' }, header('الإعدادات'),
    h('div', { class: 'card' }, h('span', { class: 'label' }, 'المظهر'), theme, ...steps.map((s) => s.el), ...toggles.map((t) => t.el)),
    h('div', { class: 'card stack' }, h('h2', null, 'بياناتك'), h('p', { class: 'muted' }, 'كل حاجة متخزنة على جهازك بس، من غير حساب ولا سيرفر.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => ctx.exportData() }, 'نسخة احتياطية'), h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'استرجاع'), file,
        h('button', { class: 'btn ghost danger', type: 'button', onclick: () => ctx.confirmReset() }, 'مسح الكل')), install, storageNote),
    h('p', { class: 'muted note center' }, 'منجز • يشتغل أوفلاين • الإصدار ١'));
  return { el, update(s) {
    steps.forEach((x) => { x.val.textContent = `${n(s.settings[x.key])} ${x.unit}`; });
    toggles.forEach((x) => x.b.setAttribute('aria-checked', String(s.settings[x.key])));
    theme.set(s.settings.theme);
    install.hidden = !ctx.canInstall(); storageNote.textContent = ctx.storageNote();
  } };
}
