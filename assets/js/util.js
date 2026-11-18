// Apró segédfüggvények: DOM, API hívás, értesítések, háttérbiztos időzítő.

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) node.style.setProperty(sk, sv);
        else node.style[sk] = sv;
      }
    }
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Szöveg biztonságos HTML-lé alakítása, a linkek kattinthatók.
export function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}

export function uid(len = 16) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export async function api(action, body, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const opts = { credentials: 'same-origin', signal: ctrl.signal, headers: {} };
    if (body !== undefined) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['X-NG'] = '1';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`api/?a=${encodeURIComponent(action)}`, opts);
    let data = null;
    try { data = await res.json(); } catch { /* üres válasz */ }
    if (!res.ok) throw new ApiError(data?.error || 'http_' + res.status, res.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e.name === 'AbortError' ? 'timeout' : 'network', 0);
  } finally {
    clearTimeout(t);
  }
}

// Web Workerben futó időzítő: a háttérbe tett fülön a Chrome a sima
// setTimeout-ot percenként egyszerire lassíthatja, a workerét nem.
const workerSrc = `const t = new Map();
onmessage = (e) => { const [id, ms] = e.data; clearTimeout(t.get(id)); if (ms >= 0) t.set(id, setTimeout(() => { t.delete(id); postMessage(id); }, ms)); };`;
let worker = null;
const callbacks = new Map();
let nextTimerId = 1;
try {
  worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
  worker.onmessage = (e) => { const cb = callbacks.get(e.data); callbacks.delete(e.data); cb?.(); };
} catch { worker = null; }

export function bgTimeout(fn, ms) {
  if (!worker) { const h = setTimeout(fn, ms); return () => clearTimeout(h); }
  const id = nextTimerId++;
  callbacks.set(id, fn);
  worker.postMessage([id, ms]);
  return () => { callbacks.delete(id); worker.postMessage([id, -1]); };
}

// --- Értesítések (toast) ---
let toastRoot = null;
export function toast(text, { type = 'info', timeout = 4000, actions = [] } = {}) {
  if (!toastRoot) toastRoot = document.body.appendChild(el('div', { class: 'toasts' }));
  const box = el('div', { class: `toast ${type}` }, el('div', { class: 'toast-text' }, text));
  let closed = false;
  const close = () => { if (closed) return; closed = true; box.classList.add('out'); setTimeout(() => box.remove(), 250); };
  if (actions.length) {
    const row = el('div', { class: 'toast-actions' });
    for (const a of actions) row.append(el('button', { class: `btn small ${a.primary ? 'primary' : ''}`, onclick: () => { close(); a.onClick?.(); } }, a.label));
    box.append(row);
  }
  toastRoot.append(box);
  if (timeout > 0) setTimeout(close, timeout);
  return close;
}

// --- Modális ablak ---
export function modal(title, content, { onClose, wide = false } = {}) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = el('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } },
    el('div', { class: `card modal ${wide ? 'wide' : ''}` },
      el('div', { class: 'modal-head' }, el('h2', {}, title), el('button', { class: 'icon-btn', title: 'Bezárás', onclick: close, html: ICONS.close })),
      content));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  return close;
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function timeLabel(ts) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const hm = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? hm : `${d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} ${hm}`;
}

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICONS = {
  mic: svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>'),
  micOff: svg('<path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 5.1 2.1M19 10a7 7 0 0 1-1.2 3.9M5 10a7 7 0 0 0 11.3 5.5M12 17v5M8 22h8M3 3l18 18"/>'),
  cam: svg('<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
  camOff: svg('<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5 0h4a2 2 0 0 1 2 2v3.3l1 1L23 7v10M1 1l22 22"/>'),
  screen: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  map: svg('<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  send: svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  phoneOff: svg('<path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 4.2 2 2 0 0 1 5.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L9 9.8M23 1L1 23"/>'),
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="M7 21l3-7 3 3v5M10 14l1-5 4 3 3 1M8 9l3-1"/>'),
  expand: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  warn: svg('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
};
