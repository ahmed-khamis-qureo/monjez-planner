// Small dependency-free helpers: DOM builder, number/date formatting.
const nf = new Intl.NumberFormat('ar-EG');
export const n = (x) => nf.format(Math.round(x));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const pad = (x) => String(x).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, delta) => { const d = parseKey(k); d.setDate(d.getDate() + delta); return dateKey(d); };
export const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);

const dayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
const wdFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' });
export const weekdayShort = (k) => wdFmt.format(parseKey(k));
export const longDate = (k) => dayFmt.format(parseKey(k));
export function dayLabel(key, today) {
  const d = diffDays(key, today);
  if (d === 0) return 'النهاردة';
  if (d === 1) return 'بكرة';
  if (d === -1) return 'امبارح';
  if (d < 0) return `متأخر ${n(-d)} يوم`;
  return dayFmt.format(parseKey(key));
}
export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
export const minutesLabel = (m) => {
  if (m < 60) return `${n(m)} د`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${n(h)} س ${n(r)} د` : `${n(h)} س`;
};

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, kids);
  return el;
}
export function svg(tag, props, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props || {})) if (v != null) el.setAttribute(k, v);
  append(el, kids);
  return el;
}
function applyProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'hidden', 'open', 'type', 'min', 'max', 'step', 'placeholder', 'name', 'id', 'maxLength'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
