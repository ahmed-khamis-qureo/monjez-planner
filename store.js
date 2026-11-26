// State container: pure reducer + tiny pub/sub + versioned persistence.
import { addDays, dateKey, uid } from './utils.js';
import { freshTimer, timerReduce } from './timer.js';

export const SUBJECTS = [
  { id: 'math', name: 'رياضيات', hue: 42 }, { id: 'physics', name: 'فيزياء', hue: 205 },
  { id: 'chem', name: 'كيمياء', hue: 150 }, { id: 'arabic', name: 'عربي', hue: 350 },
  { id: 'english', name: 'إنجليزي', hue: 270 }, { id: 'bio', name: 'أحياء', hue: 110 },
  { id: 'code', name: 'برمجة', hue: 190 }, { id: 'other', name: 'أخرى', hue: null },
];
export const subjectOf = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[SUBJECTS.length - 1];
export const subjectColor = (id) => { const s = subjectOf(id); return s.hue == null ? 'hsl(220 10% 62%)' : `hsl(${s.hue} 72% 62%)`; };

export const DEFAULT_SETTINGS = { theme: 'auto', focus: 25, short: 5, long: 15, goal: 120, sound: true, vibrate: true };
export const STORAGE_KEY = 'monjez:v1';

export function initialState() {
  return { v: 1, tasks: [], sessions: [], settings: { ...DEFAULT_SETTINGS }, timer: freshTimer(DEFAULT_SETTINGS), lastSubject: 'math' };
}

/** Accept anything (old version, imported file, corrupted JSON) and return a valid state. */
export function normalize(raw) {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  const num = (v, d, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  settings.focus = num(settings.focus, 25, 1, 120); settings.short = num(settings.short, 5, 1, 60);
  settings.long = num(settings.long, 15, 1, 90); settings.goal = num(settings.goal, 120, 10, 720);
  if (!['auto', 'dark', 'light'].includes(settings.theme)) settings.theme = 'auto';
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).filter((t) => t && typeof t.title === 'string' && t.id).map((t) => ({
    id: String(t.id), title: t.title.slice(0, 200), subject: subjectOf(t.subject).id,
    priority: [1, 2, 3].includes(t.priority) ? t.priority : 2, due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : null,
    done: !!t.done, doneAt: t.done ? Number(t.doneAt) || Date.now() : null, created: Number(t.created) || Date.now(),
  }));
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).filter((s) => s && Number(s.ts) > 0 && Number(s.minutes) > 0)
    .map((s) => ({ id: String(s.id || uid()), ts: +s.ts, minutes: +s.minutes, subject: subjectOf(s.subject).id, taskId: s.taskId || null }));
  const timer = raw.timer && typeof raw.timer === 'object' ? { ...freshTimer(settings), ...raw.timer } : freshTimer(settings);
  return { v: 1, tasks, sessions, settings, timer, lastSubject: subjectOf(raw.lastSubject).id };
}

export function reducer(state, a) {
  switch (a.type) {
    case 'task/add': {
      const task = { id: a.id, title: a.title.trim(), subject: a.subject || state.lastSubject, priority: a.priority || 2, due: a.due || null, done: false, doneAt: null, created: a.now };
      return { ...state, tasks: [task, ...state.tasks], lastSubject: task.subject };
    }
    case 'task/update':
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case 'task/toggle':
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, done: !t.done, doneAt: t.done ? null : a.now } : t)) };
    case 'task/remove':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id), timer: state.timer.taskId === a.id ? { ...state.timer, taskId: null } : state.timer };
    case 'task/restore': {
      const tasks = state.tasks.slice(); tasks.splice(Math.min(a.index, tasks.length), 0, a.task);
      return { ...state, tasks };
    }
    case 'timer': {
      const { timer, completed } = timerReduce(state.timer, a.event, state.settings);
      const sessions = completed ? [...state.sessions, { id: a.sessionId, ts: a.event.now, minutes: completed.minutes, subject: state.timer.subject, taskId: state.timer.taskId }] : state.sessions;
      return { ...state, timer, sessions };
    }
    case 'settings': {
      const next = normalize({ ...state, settings: { ...state.settings, ...a.patch } });
      const { timer } = timerReduce(state.timer, { type: 'sync' }, next.settings);
      return { ...state, settings: next.settings, timer };
    }
    case 'data/replace': return normalize(a.state);
    case 'data/reset': return initialState();
    default: return state;
  }
}

export function createStore(storage) {
  let state = initialState();
  try { state = normalize(JSON.parse(storage.getItem(STORAGE_KEY))); } catch { /* corrupted or blocked storage: start fresh */ }
  const subs = new Set();
  let timer = null;
  const persist = () => { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota or private mode */ } };
  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      clearTimeout(timer); timer = setTimeout(persist, 150);
      subs.forEach((fn) => fn(state, action));
    },
    flush() { clearTimeout(timer); persist(); },
  };
}

// ---- selectors -------------------------------------------------------------
export const keyOfTs = (ts) => dateKey(new Date(ts));
export function minutesByDay(state, keys) {
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const s of state.sessions) { const k = keyOfTs(s.ts); if (k in map) map[k] += s.minutes; }
  return keys.map((k) => map[k]);
}
export const lastDays = (today, count) => Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
export function streak(state, today) {
  const active = new Set([...state.sessions.map((s) => keyOfTs(s.ts)), ...state.tasks.filter((t) => t.doneAt).map((t) => keyOfTs(t.doneAt))]);
  let k = active.has(today) ? today : addDays(today, -1), c = 0;
  while (active.has(k)) { c++; k = addDays(k, -1); }
  return c;
}
export function visibleTasks(state, filter, query, today) {
  const q = query.trim();
  let list = state.tasks.filter((t) => !q || t.title.includes(q) || subjectOf(t.subject).name.includes(q));
  const open = (t) => !t.done;
  if (filter === 'today') list = list.filter((t) => open(t) && t.due && t.due <= today);
  else if (filter === 'upcoming') list = list.filter((t) => open(t) && (!t.due || t.due > today));
  else if (filter === 'done') list = list.filter((t) => t.done);
  const byDue = (a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0;
  return list.sort((a, b) => (a.done - b.done) || (a.done ? b.doneAt - a.doneAt : byDue(a, b) || b.priority - a.priority || b.created - a.created));
}
export function subjectTotals(state, since) {
  const m = {};
  for (const s of state.sessions) if (keyOfTs(s.ts) >= since) m[s.subject] = (m[s.subject] || 0) + s.minutes;
  return Object.entries(m).map(([id, minutes]) => ({ id, minutes })).sort((a, b) => b.minutes - a.minutes);
}
export const makeAction = {
  addTask: (f) => ({ type: 'task/add', id: uid(), now: Date.now(), ...f }),
  timer: (type, extra = {}) => ({ type: 'timer', sessionId: uid(), event: { type, now: Date.now(), ...extra } }),
};
