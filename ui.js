// Reusable UI pieces: toast, ring, task row (with swipe), dialog for add/edit.
import { h, svg, n, dayLabel, clear } from './utils.js';
import { SUBJECTS, subjectColor, subjectOf } from './store.js';
import { dateKey, addDays } from './utils.js';

export const ICONS = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  focus: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18zM9 1h6',
  stats: 'M5 20V10M12 20V4M19 20v-7',
  settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M16 4v4M8 10v4M18 16v4',
  plus: 'M12 5v14M5 12h14', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', check: 'M5 12.5l4.5 4.5L19 7.5',
  play: 'M8 5l11 7-11 7z', pause: 'M8 5v14M16 5v14', reset: 'M4 12a8 8 0 108-8H7M7 1L4 4l3 3', skip: 'M5 5l9 7-9 7zM18 5v14',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z',
};
export const icon = (name, size = 22) => svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, svg('path', { d: ICONS[name] }));

// ---- toast ------------------------------------------------------------------
export function createToaster(host) {
  let timer;
  return (msg, action) => {
    clearTimeout(timer); clear(host);
    const el = h('div', { class: 'toast' }, h('span', null, msg));
    if (action) el.append(h('button', { class: 'toast-btn', type: 'button', onclick: () => { action.run(); clear(host); } }, action.label));
    host.append(el);
    timer = setTimeout(() => clear(host), action ? 6000 : 3200);
  };
}

// ---- progress ring ---------------------------------------------------------
export function ring({ size = 160, stroke = 12, label = '' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const arc = svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round', class: 'ring-arc', 'stroke-dasharray': c, 'stroke-dashoffset': c, transform: `rotate(-90 ${size / 2} ${size / 2})` });
  const el = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'ring', role: 'img', 'aria-label': label },
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, class: 'ring-track' }), arc);
  return { el, set(v, aria) { arc.setAttribute('stroke-dashoffset', c * (1 - Math.min(1, Math.max(0, v)))); if (aria) el.setAttribute('aria-label', aria); } };
}

// ---- task row ---------------------------------------------------------------
export function taskRow(task, ctx, today) {
  const li = h('li', { class: `task${task.done ? ' is-done' : ''}`, dataset: { id: task.id } });
  const check = h('button', { class: 'check', type: 'button', role: 'checkbox', 'aria-checked': String(task.done), 'aria-label': `تم: ${task.title}`,
    onclick: () => { ctx.vibrate(12); ctx.dispatch({ type: 'task/toggle', id: task.id, now: Date.now() }); } }, icon('check', 16));
  const overdue = task.due && !task.done && task.due < today;
  const meta = h('div', { class: 'task-meta' },
    h('span', { class: 'chip-dot', style: { '--c': subjectColor(task.subject) } }), h('span', null, subjectOf(task.subject).name),
    task.due && h('span', { class: overdue ? 'late' : '' }, dayLabel(task.due, today)),
    task.priority === 3 && h('span', { class: 'prio' }, 'مهم'));
  const body = h('button', { class: 'task-body', type: 'button', onclick: () => ctx.editTask(task.id) }, h('span', { class: 'task-title' }, task.title), meta);
  const del = h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': `حذف: ${task.title}`, onclick: () => ctx.removeTask(task.id) }, icon('trash', 18));
  li.append(check, body, del);
  attachSwipe(li, () => ctx.removeTask(task.id));
  return li;
}

function attachSwipe(li, onCommit) {
  let sx = 0, sy = 0, dx = 0, active = false, locked = false, id = null;
  li.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || e.target.closest('.check, .icon-btn')) return; sx = e.clientX; sy = e.clientY; dx = 0; active = true; locked = false; id = e.pointerId; });
  li.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== id) return;
    dx = e.clientX - sx; const dy = e.clientY - sy;
    if (!locked && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) { locked = true; li.setPointerCapture(id); li.classList.add('swiping'); }
    if (locked) { li.style.transform = `translateX(${dx}px)`; li.style.opacity = String(1 - Math.min(Math.abs(dx), 220) / 320); }
  });
  const end = (e) => {
    if (!active || e.pointerId !== id) return; active = false;
    li.classList.remove('swiping');
    if (locked && Math.abs(dx) > 90) { li.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`; li.style.opacity = '0'; setTimeout(onCommit, 160); }
    else { li.style.transform = ''; li.style.opacity = ''; }
  };
  li.addEventListener('pointerup', end); li.addEventListener('pointercancel', end);
}

export function emptyState(title, text) {
  return h('div', { class: 'empty' }, svg('svg', { viewBox: '0 0 64 64', width: 72, height: 72, 'aria-hidden': 'true' },
    svg('circle', { cx: 32, cy: 32, r: 26, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-dasharray': '4 6', opacity: '.45' }),
    svg('path', { d: 'M21 33l8 8 15-17', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })),
    h('strong', null, title), h('p', null, text));
}

export function segmented({ name, options, value, onChange, label }) {
  const root = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const btns = options.map((o) => h('button', { type: 'button', role: 'radio', class: 'seg-btn', 'data-v': o.value, 'aria-checked': String(o.value === value), onclick: () => { set(o.value); onChange(o.value); } }, o.label));
  const set = (v) => btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
  root.append(...btns);
  root.set = set;
  return root;
}

// ---- add / edit dialog ------------------------------------------------------
export function createTaskDialog(ctx) {
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'dlg-title' });
  let editing = null, prio = 2;
  const title = h('input', { id: 'f-title', type: 'text', maxLength: 200, placeholder: 'مثلاً: حل تمارين الباب التالت', autocomplete: 'off', required: true });
  const subject = h('select', { id: 'f-subject' }, SUBJECTS.map((s) => h('option', { value: s.id }, s.name)));
  const due = h('input', { id: 'f-due', type: 'date' });
  const prioSeg = segmented({ label: 'الأهمية', options: [{ value: 1, label: 'عادي' }, { value: 2, label: 'متوسط' }, { value: 3, label: 'مهم' }], value: 2, onChange: (v) => { prio = +v; } });
  const quick = (label, delta) => h('button', { type: 'button', class: 'chip', onclick: () => { due.value = delta == null ? '' : addDays(dateKey(), delta); } }, label);
  const heading = h('h2', { id: 'dlg-title' }, 'مهمة جديدة');
  const delBtn = h('button', { type: 'button', class: 'btn ghost danger', onclick: () => { const id = editing; dlg.close(); ctx.removeTask(id); } }, 'حذف');
  const form = h('form', { method: 'dialog', novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    if (!title.value.trim()) { title.setAttribute('aria-invalid', 'true'); title.focus(); ctx.vibrate([30, 40, 30]); return; }
    const f = { title: title.value, subject: subject.value, priority: prio, due: due.value || null };
    if (editing) ctx.dispatch({ type: 'task/update', id: editing, patch: { ...f, title: f.title.trim() } });
    else ctx.dispatch(ctx.make.addTask(f));
    ctx.toast(editing ? 'اتحفظ التعديل' : 'اتضافت المهمة'); dlg.close();
  } },
    heading,
    h('label', { for: 'f-title' }, 'المهمة'), title,
    h('div', { class: 'row2' }, h('div', null, h('label', { for: 'f-subject' }, 'المادة'), subject), h('div', null, h('label', { for: 'f-due' }, 'الموعد'), due)),
    h('div', { class: 'chips' }, quick('النهاردة', 0), quick('بكرة', 1), quick('بعد أسبوع', 7), quick('من غير موعد', null)),
    h('span', { class: 'label' }, 'الأهمية'), prioSeg,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'submit' }, 'حفظ'), h('button', { class: 'btn ghost', type: 'button', onclick: () => dlg.close() }, 'إلغاء'), delBtn));
  title.addEventListener('input', () => title.removeAttribute('aria-invalid'));
  dlg.append(form);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop tap closes
  return {
    el: dlg,
    open(task) {
      editing = task ? task.id : null;
      heading.textContent = task ? 'تعديل المهمة' : 'مهمة جديدة';
      title.value = task ? task.title : ''; title.removeAttribute('aria-invalid');
      subject.value = task ? task.subject : ctx.store.get().lastSubject;
      due.value = task ? task.due || '' : dateKey();
      prio = task ? task.priority : 2; prioSeg.set(prio);
      delBtn.hidden = !task;
      dlg.showModal(); title.focus();
    },
  };
}
export { n };
