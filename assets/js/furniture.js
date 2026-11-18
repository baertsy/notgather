// Bútorok és tárgyak katalógusa. Minden rajz saját, kódból generált SVG
// (enyhén felülről, "3/4" nézetben), így nincs szükség külső képekre.
//
// Mezők:
//   label, cat, w, h      név, kategória, alapméret
//   layer                 0 = padlón (szőnyeg), 1 = bútor, 2 = asztalon lévő tárgy, 3 = fal/ajtó
//   solid                 nem lehet rajta átmenni
//   seats                 ülőhelyek: [[x-arány, y-arány]], pose: 'sit' | 'lie'
//   actions               interakciók (lásd interact.js)
//   tint, resizable, hasLabel

import { shade } from './avatar.js';

const OL = 'stroke="rgba(0,0,0,.35)" stroke-width="1"';
const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="${r}" fill="${fill}" ${extra}/>`;
const circ = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;

// Doboz vastagsággal: alul sötétebb perem, felül a lap.
function box(w, h, c, depth = 6, r = 4) {
  return rr(0.5, 0.5, w - 1, h - 1, r, shade(c, -0.3), OL) + rr(0.5, 0.5, w - 1, h - depth - 1, r, c, OL);
}
const wood = (c) => c || '#b07a4a';
const BOOK = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#64748b'];

function escXml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------- növények állapota

/** A növény állapota a nedvesség alapján: over | good | thirsty | dying */
export function plantStatus(st, now = Date.now() / 1000) {
  const m0 = st && typeof st.m === 'number' ? st.m : 80;
  const t = st && st.t ? st.t : now;
  const m = Math.max(0, m0 - 30 * Math.max(0, now - t) / 86400);
  const status = m > 115 ? 'over' : m >= 45 ? 'good' : m >= 20 ? 'thirsty' : 'dying';
  return { m, status };
}
const LEAF = { good: '#16a34a', thirsty: '#84a32b', dying: '#a16207', over: '#a3b818' };
const leafOf = (st) => LEAF[plantStatus(st).status];

export const CATEGORIES = [
  ['office', 'Iroda'],
  ['lounge', 'Pihenő'],
  ['fun', 'Játék, buli'],
  ['kitchen', 'Konyha'],
  ['garden', 'Kert'],
  ['decor', 'Dísz'],
  ['structure', 'Fal, ajtó'],
];

const SIT = (spots = [[0.5, 0.55]]) => ({ seats: spots, pose: 'sit' });

export const CATALOG = {
  // ============================================================ IRODA
  desk: {
    label: 'Íróasztal', cat: 'office', w: 120, h: 60, layer: 1, solid: true, tint: '#b07a4a', resizable: true,
    draw: (w, h, c) => box(w, h, wood(c), 8) + rr(4, 4, w - 8, 2, 1, '#fff', 'opacity=".18"'),
  },
  desk_white: {
    label: 'Fehér asztal', cat: 'office', w: 110, h: 56, layer: 1, solid: true, tint: '#e5e7eb', resizable: true,
    draw: (w, h, c) => box(w, h, c || '#e5e7eb', 7) + rr(w - 14, h - 6, 8, 6, 1, '#94a3b8'),
  },
  standing_desk: {
    label: 'Állóasztal', cat: 'office', w: 110, h: 56, layer: 1, solid: true, tint: '#cbd5e1', actions: ['standdesk'],
    draw: (w, h, c, l, st) => {
      const up = st?.up;
      return (up ? rr(6, h - 6, 6, 6, 1, '#475569') + rr(w - 12, h - 6, 6, 6, 1, '#475569') : '')
        + box(w, up ? h - 6 : h, c || '#cbd5e1', 7) + rr(w - 18, 6, 10, 4, 2, up ? '#22c55e' : '#64748b');
    },
  },
  meeting_table: {
    label: 'Tárgyalóasztal', cat: 'office', w: 200, h: 90, layer: 1, solid: true, tint: '#8b5a2b', resizable: true,
    draw: (w, h, c) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${h / 2.2}" fill="${shade(wood(c), -0.3)}" ${OL}/>`
      + `<rect x="1" y="1" width="${w - 2}" height="${h - 10}" rx="${h / 2.4}" fill="${wood(c)}" ${OL}/>`
      + `<rect x="${w * 0.15}" y="${h * 0.22}" width="${w * 0.7}" height="3" rx="1.5" fill="#fff" opacity=".15"/>`,
  },
  round_table: {
    label: 'Kerek asztal', cat: 'office', w: 80, h: 80, layer: 1, solid: true, tint: '#b07a4a', resizable: true,
    draw: (w, h, c) => `<ellipse cx="${w / 2}" cy="${h / 2 + 3}" rx="${w / 2 - 1}" ry="${h / 2 - 4}" fill="${shade(wood(c), -0.3)}" ${OL}/>`
      + `<ellipse cx="${w / 2}" cy="${h / 2 - 2}" rx="${w / 2 - 1}" ry="${h / 2 - 4}" fill="${wood(c)}" ${OL}/>`,
  },
  chair: {
    label: 'Szék', cat: 'office', w: 32, h: 32, layer: 1, tint: '#2563eb', ...SIT(), actions: ['sit'],
    draw: (w, h, c) => rr(5, 9, 22, 20, 6, c || '#2563eb', OL) + rr(4, 2, 24, 9, 4, shade(c || '#2563eb', -0.25), OL),
  },
  office_chair: {
    label: 'Irodai szék', cat: 'office', w: 34, h: 34, layer: 1, tint: '#1f2937', ...SIT(), actions: ['sit'],
    draw: (w, h, c) => {
      const col = c || '#1f2937';
      return `<g stroke="#475569" stroke-width="2.4" stroke-linecap="round"><path d="M17 22L5 31M17 22L29 31M17 22L17 33"/></g>`
        + circ(17, 19, 11, col, OL) + rr(6, 2, 22, 10, 5, shade(col, 0.15), OL);
    },
  },
  laptop: {
    label: 'Laptop', cat: 'office', w: 30, h: 22, layer: 2, actions: ['type'],
    draw: (w, h) => rr(1, 1, w - 2, 12, 2, '#475569', OL) + rr(3, 2.5, w - 6, 9, 1, '#60a5fa') + rr(4, 3.5, 8, 2, 1, '#fff', 'opacity=".35"')
      + rr(0.5, 12, w - 1, h - 12.5, 2, '#cbd5e1', OL) + rr(w / 2 - 4, h - 4, 8, 2, 1, '#94a3b8'),
  },
  monitor: {
    label: 'Monitor', cat: 'office', w: 42, h: 30, layer: 2, actions: ['type'],
    draw: (w, h) => rr(w / 2 - 3, h - 8, 6, 6, 1, '#334155') + rr(w / 2 - 9, h - 3, 18, 3, 1.5, '#334155')
      + rr(0.5, 0.5, w - 1, h - 8, 2.5, '#111827', OL) + rr(3, 3, w - 6, h - 13, 1, '#0ea5e9') + rr(5, 5, 10, 3, 1, '#fff', 'opacity=".3"'),
  },
  keyboard: {
    label: 'Billentyűzet', cat: 'office', w: 30, h: 10, layer: 2, actions: ['type'],
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#e2e8f0', OL) + [2.5, 5.5].map((y) => `<path d="M3 ${y + 0.5}H${w - 3}" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="2 1.2"/>`).join(''),
  },
  desk_phone: {
    label: 'Asztali telefon', cat: 'office', w: 24, h: 18, layer: 2, actions: ['phone'],
    draw: () => rr(1, 3, 22, 14, 3, '#1f2937', OL) + rr(3, 1, 18, 6, 3, '#334155', OL) + [0, 1, 2].map((i) => [0, 1].map((j) => circ(8 + i * 4, 10 + j * 3.5, 1.1, '#94a3b8')).join('')).join(''),
  },
  desk_lamp: {
    label: 'Asztali lámpa', cat: 'office', w: 20, h: 22, layer: 2, actions: ['toggle'],
    draw: (w, h, c, l, st) => (st?.on ? circ(10, 8, 12, '#fde68a', 'opacity=".35"') : '') + rr(8, 14, 4, 6, 1, '#475569') + rr(3, 18, 14, 4, 2, '#334155')
      + `<path d="M3 10L10 2L17 10Z" fill="${st?.on ? '#facc15' : '#64748b'}" ${OL}/>`,
  },
  papers: {
    label: 'Papírok', cat: 'office', w: 24, h: 18, layer: 2, actions: ['read'],
    draw: () => `<rect x="3" y="2" width="15" height="14" fill="#f8fafc" transform="rotate(-8 10 9)" ${OL}/><rect x="7" y="2" width="15" height="14" fill="#fff" transform="rotate(6 14 9)" ${OL}/>`
      + `<path d="M10 6H19M10 9H19M10 12H16" stroke="#94a3b8" stroke-width="1" transform="rotate(6 14 9)"/>`,
  },
  mug: {
    label: 'Bögre', cat: 'office', w: 12, h: 12, layer: 2, tint: '#ef4444', actions: ['takemug'],
    draw: (w, h, c) => circ(5.5, 6, 5, c || '#ef4444', OL) + circ(5.5, 6, 3, '#78350f') + `<path d="M10 4.5Q12.5 6 10 8" stroke="${c || '#ef4444'}" stroke-width="1.8" fill="none"/>`,
  },
  cabinet: {
    label: 'Iratszekrény', cat: 'office', w: 44, h: 50, layer: 1, solid: true, tint: '#94a3b8', actions: ['drawer'],
    draw: (w, h, c) => box(w, h, c || '#94a3b8', 5, 3) + [0.28, 0.58].map((f) => rr(5, h * f, w - 10, 2, 1, shade(c || '#94a3b8', -0.25)) + rr(w / 2 - 5, h * f - 6, 10, 3, 1.5, '#e2e8f0')).join(''),
  },
  bookshelf: {
    label: 'Könyvespolc', cat: 'office', w: 100, h: 36, layer: 1, solid: true, tint: '#8b5a2b', resizable: true, actions: ['book'],
    draw: (w, h, c) => {
      let s = box(w, h, wood(c), 5, 3) + rr(4, 4, w - 8, h - 14, 2, shade(wood(c), -0.45));
      let x = 6, i = 0;
      while (x < w - 10) {
        const bw = 5 + ((i * 7) % 4);
        const bh = h - 18 - ((i * 5) % 6);
        s += rr(x, h - 10 - bh, bw, bh, 1, BOOK[i % BOOK.length]);
        x += bw + 1.5; i++;
      }
      return s;
    },
  },
  printer: {
    label: 'Nyomtató', cat: 'office', w: 44, h: 34, layer: 1, solid: true, actions: ['print'],
    draw: (w, h) => box(w, h, '#e5e7eb', 6, 4) + rr(8, 4, w - 16, 9, 2, '#334155') + rr(11, 1, w - 22, 6, 1, '#fff', OL) + circ(w - 8, h - 13, 2, '#22c55e'),
  },
  shredder: {
    label: 'Iratmegsemmisítő', cat: 'office', w: 30, h: 26, layer: 1, solid: true, actions: ['shred'],
    draw: (w, h) => box(w, h, '#475569', 5, 3) + rr(5, 4, w - 10, 3, 1, '#0f172a') + `<path d="M8 10V${h - 8}M12 10V${h - 8}M16 10V${h - 8}M20 10V${h - 8}" stroke="#e2e8f0" stroke-width="1.2" opacity=".6"/>`,
  },
  whiteboard: {
    label: 'Tábla', cat: 'office', w: 120, h: 26, layer: 1, solid: true, resizable: true, actions: ['draw'],
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#94a3b8', OL) + rr(3, 3, w - 6, h - 9, 1, '#fff')
      + `<path d="M10 ${h * 0.35}Q20 ${h * 0.15} 30 ${h * 0.4}T50 ${h * 0.3}" stroke="#2563eb" stroke-width="1.6" fill="none"/>`
      + `<path d="M${w * 0.55} ${h * 0.25}H${w * 0.85}M${w * 0.55} ${h * 0.45}H${w * 0.75}" stroke="#ef4444" stroke-width="1.6"/>`
      + rr(w / 2 - 12, h - 5, 24, 3, 1, '#64748b'),
  },
  corkboard: {
    label: 'Parafatábla', cat: 'office', w: 90, h: 22, layer: 1, solid: true, resizable: true, actions: ['notes_board'],
    draw: (w, h, c, l, st) => {
      const n = Math.min(8, (st?.notes || []).length || 3);
      const cols = ['#fde047', '#f9a8d4', '#86efac', '#93c5fd'];
      return rr(0.5, 0.5, w - 1, h - 1, 2, '#92400e', OL) + rr(3, 3, w - 6, h - 6, 1, '#d6a36b')
        + Array.from({ length: n }, (_, i) => rr(6 + i * ((w - 18) / n), 5 + (i % 2) * 3, 9, 8, 1, cols[i % 4], `transform="rotate(${(i % 3) * 4 - 4} ${10 + i * ((w - 18) / n)} 9)"`)).join('');
    },
  },
  wall_calendar: {
    label: 'Falinaptár', cat: 'office', w: 26, h: 30, layer: 1, actions: ['calendar'],
    draw: () => {
      const d = new Date().getDate();
      return rr(1, 3, 24, 26, 2, '#fff', OL) + rr(1, 3, 24, 8, 2, '#ef4444') + circ(8, 3, 1.5, '#334155') + circ(18, 3, 1.5, '#334155')
        + `<text x="13" y="23" font-size="11" font-weight="700" text-anchor="middle" fill="#0f172a" font-family="-apple-system,sans-serif">${d}</text>`;
    },
  },
  server_rack: {
    label: 'Szerver', cat: 'office', w: 40, h: 50, layer: 1, solid: true, actions: ['server'],
    draw: (w, h) => box(w, h, '#1f2937', 6, 3) + [0, 1, 2, 3, 4].map((i) => rr(5, 5 + i * 7.5, w - 10, 5, 1, '#0f172a') + `<circle class="blink b${i % 3}" cx="${w - 9}" cy="${7.5 + i * 7.5}" r="1.4" fill="${i % 2 ? '#22c55e' : '#38bdf8'}"/>`).join(''),
  },
  projector_screen: {
    label: 'Vetítővászon', cat: 'office', w: 130, h: 18, layer: 1, solid: true, resizable: true, actions: ['present'],
    draw: (w, h) => rr(0, 0, w, 6, 3, '#334155') + rr(4, 5, w - 8, h - 6, 1, '#f8fafc', OL) + rr(w / 2 - 3, h - 3, 6, 3, 1, '#334155'),
  },
  globe: {
    label: 'Földgömb', cat: 'office', w: 26, h: 30, layer: 2, actions: ['globe'],
    draw: () => rr(8, 25, 10, 4, 2, '#92400e') + rr(12, 20, 2, 6, 1, '#92400e') + circ(13, 12, 10, '#38bdf8', OL)
      + `<path d="M6 9C9 7 11 10 14 9S18 5 20 8M7 15C10 13 13 17 17 15" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  trophy: {
    label: 'Trófea', cat: 'office', w: 22, h: 26, layer: 2, actions: ['trophy'],
    draw: () => rr(5, 21, 12, 4, 1, '#78350f') + rr(9, 15, 4, 7, 1, '#ca8a04') + `<path d="M4 3H18V8C18 13 15 15 11 15S4 13 4 8Z" fill="#facc15" ${OL}/>`
      + `<path d="M4 5H1V7C1 9 3 10 4 10M18 5H21V7C21 9 19 10 18 10" stroke="#ca8a04" stroke-width="1.5" fill="none"/>` + rr(7, 4, 3, 6, 1.5, '#fff', 'opacity=".5"'),
  },
  coat_rack: {
    label: 'Fogas', cat: 'office', w: 24, h: 24, layer: 1, actions: ['coat'],
    draw: (w, h, c, l, st) => circ(12, 12, 10, '#78350f', 'opacity=".25"') + circ(12, 12, 3, '#78350f', OL)
      + `<path d="M12 12L4 5M12 12L20 5M12 12L12 2" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>`
      + (st?.coats || []).slice(0, 3).map((cc, i) => circ([5, 19, 12][i], [6, 6, 3][i], 4.5, cc.color || '#64748b', OL)).join(''),
  },
  suggestion_box: {
    label: 'Ötletláda', cat: 'office', w: 28, h: 26, layer: 1, solid: true, actions: ['ideas'],
    draw: (w, h) => box(w, h, '#b45309', 5, 3) + rr(7, 6, 14, 3, 1.5, '#1c1917') + `<text x="14" y="18" font-size="7" text-anchor="middle" fill="#fde68a" font-weight="700" font-family="sans-serif">ÖTLET</text>`,
  },
  tv: {
    label: 'Kijelző / TV', cat: 'office', w: 110, h: 64, layer: 1, solid: true, resizable: true, actions: ['watch'],
    draw: (w, h) => rr(w / 2 - 4, h - 10, 8, 8, 1, '#334155') + rr(w / 2 - 18, h - 4, 36, 4, 2, '#334155')
      + rr(0.5, 0.5, w - 1, h - 10, 3, '#0f172a', OL) + rr(4, 4, w - 8, h - 18, 1, '#1e3a8a')
      + `<path d="M8 ${h - 18}L${w * 0.3} ${h * 0.35}L${w * 0.5} ${h * 0.55}L${w * 0.7} ${h * 0.25}L${w - 8} ${h - 18}Z" fill="#3b82f6" opacity=".5"/>`,
  },

  // ============================================================ PIHENŐ
  sofa: {
    label: 'Kanapé', cat: 'lounge', w: 120, h: 52, layer: 1, solid: true, tint: '#64748b', resizable: true, ...SIT([[0.27, 0.62], [0.5, 0.62], [0.73, 0.62]]), actions: ['sit'],
    draw: (w, h, c) => {
      const col = c || '#64748b';
      return rr(0.5, 0.5, w - 1, 18, 6, shade(col, -0.2), OL) + rr(0.5, 12, w - 1, h - 12.5, 6, col, OL)
        + rr(0.5, 8, 14, h - 8.5, 5, shade(col, -0.1), OL) + rr(w - 14.5, 8, 14, h - 8.5, 5, shade(col, -0.1), OL)
        + `<path d="M${w / 2} 16V${h - 6}" stroke="${shade(col, -0.25)}" stroke-width="1.5"/>`;
    },
  },
  armchair: {
    label: 'Fotel', cat: 'lounge', w: 52, h: 50, layer: 1, solid: true, tint: '#0d9488', ...SIT([[0.5, 0.62]]), actions: ['sit'],
    draw: (w, h, c) => {
      const col = c || '#0d9488';
      return rr(0.5, 0.5, w - 1, 18, 6, shade(col, -0.2), OL) + rr(6, 12, w - 12, h - 12.5, 6, col, OL)
        + rr(0.5, 8, 11, h - 8.5, 5, shade(col, -0.1), OL) + rr(w - 11.5, 8, 11, h - 8.5, 5, shade(col, -0.1), OL);
    },
  },
  beanbag: {
    label: 'Babzsák', cat: 'lounge', w: 44, h: 42, layer: 1, tint: '#f59e0b', ...SIT([[0.5, 0.6]]), actions: ['sit'],
    draw: (w, h, c) => `<path d="M6 30C0 18 8 3 22 3S44 16 38 30C35 39 9 39 6 30Z" fill="${c || '#f59e0b'}" ${OL}/><ellipse cx="22" cy="24" rx="11" ry="7" fill="${shade(c || '#f59e0b', -0.15)}"/><ellipse cx="15" cy="11" rx="5" ry="2.5" fill="#fff" opacity=".25"/>`,
  },
  bench: {
    label: 'Pad', cat: 'lounge', w: 100, h: 30, layer: 1, solid: true, tint: '#a16207', resizable: true, ...SIT([[0.28, 0.55], [0.72, 0.55]]), actions: ['sit'],
    draw: (w, h, c) => rr(4, 0.5, w - 8, 8, 3, shade(wood(c), -0.15), OL) + [10, 15, 20].map((y) => rr(0.5, y, w - 1, 4.5, 2, wood(c), OL)).join(''),
  },
  coffee_table: {
    label: 'Dohányzóasztal', cat: 'lounge', w: 70, h: 40, layer: 1, solid: true, tint: '#a16207', resizable: true,
    draw: (w, h, c) => box(w, h, wood(c), 6, 6) + rr(w * 0.25, h * 0.25, w * 0.2, h * 0.3, 3, '#fff', 'opacity=".2"'),
  },
  rug: {
    label: 'Szőnyeg', cat: 'lounge', w: 160, h: 110, layer: 0, tint: '#7c3aed', resizable: true,
    draw: (w, h, c) => {
      const col = c || '#7c3aed';
      return rr(0.5, 0.5, w - 1, h - 1, 10, col, 'opacity=".85"') + rr(8, 8, w - 16, h - 16, 6, 'none', `stroke="${shade(col, 0.35)}" stroke-width="2" stroke-dasharray="6 4"`)
        + rr(18, 18, w - 36, h - 36, 4, shade(col, -0.15), 'opacity=".7"');
    },
  },
  rug_round: {
    label: 'Kerek szőnyeg', cat: 'lounge', w: 120, h: 120, layer: 0, tint: '#0e7490', resizable: true,
    draw: (w, h, c) => {
      const col = c || '#0e7490';
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="${col}" opacity=".85"/>`
        + `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 10}" ry="${h / 2 - 10}" fill="none" stroke="${shade(col, 0.4)}" stroke-width="2" stroke-dasharray="5 4"/>`
        + `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 4}" ry="${h / 4}" fill="${shade(col, -0.2)}"/>`;
    },
  },
  floor_lamp: {
    label: 'Állólámpa', cat: 'lounge', w: 30, h: 30, layer: 1, actions: ['toggle'],
    draw: (w, h, c, l, st) => (st?.on === false ? '' : circ(15, 15, 20, '#fde68a', 'opacity=".22"')) + circ(15, 15, 9, st?.on === false ? '#94a3b8' : '#fef3c7', OL) + circ(15, 15, 3, st?.on === false ? '#475569' : '#f59e0b'),
  },
  fireplace: {
    label: 'Kandalló', cat: 'lounge', w: 90, h: 40, layer: 1, solid: true, actions: ['fireplace'],
    draw: (w, h) => box(w, h, '#78716c', 6, 3) + rr(4, 2, w - 8, 6, 2, '#a8a29e') + rr(w / 2 - 22, 10, 44, h - 18, 10, '#1c1917')
      + `<g class="flame"><path d="M${w / 2 - 12} ${h - 9}C${w / 2 - 14} ${h - 20} ${w / 2 - 4} ${h - 22} ${w / 2 - 2} ${h - 30}C${w / 2 + 4} ${h - 22} ${w / 2 + 14} ${h - 20} ${w / 2 + 12} ${h - 9}Z" fill="#f97316"/>`
      + `<path d="M${w / 2 - 6} ${h - 9}C${w / 2 - 7} ${h - 16} ${w / 2} ${h - 18} ${w / 2} ${h - 23}C${w / 2 + 3} ${h - 17} ${w / 2 + 8} ${h - 15} ${w / 2 + 6} ${h - 9}Z" fill="#fde047"/></g>`
      + rr(w / 2 - 16, h - 10, 32, 3, 1.5, '#78350f'),
  },
  aquarium: {
    label: 'Akvárium', cat: 'lounge', w: 80, h: 40, layer: 1, solid: true, actions: ['aquarium'],
    draw: (w, h) => box(w, h, '#334155', 6, 3) + rr(4, 3, w - 8, h - 13, 2, '#0ea5e9', 'opacity=".75"') + rr(4, h - 16, w - 8, 6, 1, '#d6b98c')
      + `<g class="fish f1"><path d="M20 14l6-3v6z" fill="#f97316"/><ellipse cx="17" cy="14" rx="5" ry="3" fill="#f97316"/></g>`
      + `<g class="fish f2"><path d="M54 21l6-3v6z" fill="#facc15"/><ellipse cx="51" cy="21" rx="4.5" ry="2.6" fill="#facc15"/></g>`
      + `<path d="M12 ${h - 15}C10 ${h - 22} 14 ${h - 25} 12 ${h - 31}M64 ${h - 15}C66 ${h - 21} 62 ${h - 24} 64 ${h - 29}" stroke="#22c55e" stroke-width="2.5" fill="none"/>`,
  },
  hammock: {
    label: 'Függőágy', cat: 'lounge', w: 110, h: 34, layer: 1, tint: '#f97316', seats: [[0.5, 0.55]], pose: 'lie', actions: ['lie'],
    draw: (w, h, c) => circ(4, h / 2, 4, '#78350f') + circ(w - 4, h / 2, 4, '#78350f') + `<path d="M6 ${h / 2}Q${w / 2} ${h + 4} ${w - 6} ${h / 2}Q${w / 2} ${h - 8} 6 ${h / 2}Z" fill="${c || '#f97316'}" ${OL}/>`
      + `<path d="M20 ${h * 0.62}H${w - 20}" stroke="#fff" stroke-width="1.5" opacity=".35" stroke-dasharray="4 4"/>`,
  },
  yoga_mat: {
    label: 'Jógamatrac', cat: 'lounge', w: 36, h: 80, layer: 0, tint: '#8b5cf6', actions: ['yoga'],
    draw: (w, h, c) => rr(1, 1, w - 2, h - 2, 6, c || '#8b5cf6', OL) + rr(1, 1, w - 2, 10, 5, shade(c || '#8b5cf6', -0.25)),
  },
  treadmill: {
    label: 'Futópad', cat: 'lounge', w: 44, h: 90, layer: 1, solid: true, actions: ['run'],
    draw: (w, h) => rr(2, 10, w - 4, h - 12, 6, '#334155', OL) + rr(7, 16, w - 14, h - 24, 3, '#0f172a') + `<path d="M9 30H${w - 9}M9 45H${w - 9}M9 60H${w - 9}" stroke="#334155" stroke-width="1.5"/>`
      + rr(4, 0.5, w - 8, 12, 4, '#475569', OL) + rr(w / 2 - 7, 3, 14, 6, 1, '#22d3ee'),
  },
  radio: {
    label: 'Rádió', cat: 'lounge', w: 36, h: 24, layer: 2, tint: '#b91c1c', actions: ['radio'],
    draw: (w, h, c) => rr(1, 5, w - 2, h - 6, 4, c || '#b91c1c', OL) + circ(11, 15, 6, '#1f2937') + circ(11, 15, 3.5, '#475569') + rr(21, 10, 10, 3, 1, '#fde68a') + `<path d="M8 5L20 0" stroke="#64748b" stroke-width="1.4"/>`,
  },
  cat: {
    label: 'Irodai macska', cat: 'lounge', w: 34, h: 24, layer: 1, tint: '#f97316', actions: ['pet', 'feedpet'],
    draw: (w, h, c) => {
      const col = c || '#f97316';
      return `<ellipse cx="16" cy="22" rx="13" ry="2.5" fill="rgba(0,0,0,.25)"/><g class="tail"><path d="M27 18C33 16 33 8 29 7" stroke="${col}" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>`
        + `<ellipse cx="17" cy="16" rx="11" ry="6.5" fill="${col}" ${OL}/>` + circ(8, 10, 6, col, OL)
        + `<path d="M4 7L4.5 1.5L8 5M9 4.5L12 1L12.5 6.5" fill="${col}" ${OL}/>` + circ(6.2, 10, 0.9, '#1f2937') + circ(9.8, 10, 0.9, '#1f2937')
        + `<path d="M7 12.5Q8 13.4 9 12.5" stroke="#7c2d12" stroke-width=".7" fill="none"/><path d="M18 12L18 20M22 12L22 20" stroke="${shade(col, -0.25)}" stroke-width="1.2" opacity=".6"/>`;
    },
  },
  dog: {
    label: 'Irodai kutya', cat: 'lounge', w: 38, h: 28, layer: 1, tint: '#a16207', actions: ['pet', 'feedpet'],
    draw: (w, h, c) => {
      const col = c || '#a16207';
      return `<ellipse cx="19" cy="26" rx="15" ry="2.5" fill="rgba(0,0,0,.25)"/><g class="tail"><path d="M31 16C36 13 36 9 34 7" stroke="${col}" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>`
        + `<ellipse cx="20" cy="19" rx="13" ry="7" fill="${col}" ${OL}/>` + circ(9, 11, 7, col, OL)
        + `<ellipse cx="4.5" cy="11" rx="3" ry="5.5" fill="${shade(col, -0.3)}"/><ellipse cx="13.5" cy="11" rx="3" ry="5.5" fill="${shade(col, -0.3)}"/>`
        + circ(7, 10, 1, '#1f2937') + circ(11, 10, 1, '#1f2937') + `<ellipse cx="9" cy="14.5" rx="2.2" ry="1.6" fill="#1f2937"/><path d="M8 17Q9 19 10 17" fill="#f87171"/>`;
    },
  },

  // ============================================================ JÁTÉK, BULI
  pingpong: {
    label: 'Pingpongasztal', cat: 'fun', w: 160, h: 90, layer: 1, solid: true, actions: ['pong'],
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 3, '#14532d', OL) + rr(0.5, 0.5, w - 1, h - 7, 3, '#15803d', OL)
      + rr(4, 4, w - 8, h - 15, 1, 'none', 'stroke="#fff" stroke-width="1.5"') + `<path d="M${w / 2} 2V${h - 6}" stroke="#e5e7eb" stroke-width="3"/><path d="M4 ${(h - 7) / 2}H${w - 4}" stroke="#fff" stroke-width="1"/>`,
  },
  foosball: {
    label: 'Csocsóasztal', cat: 'fun', w: 130, h: 70, layer: 1, solid: true, actions: ['pong'],
    draw: (w, h) => box(w, h, '#78350f', 7, 4) + rr(8, 6, w - 16, h - 20, 2, '#16a34a')
      + [0.2, 0.35, 0.5, 0.65, 0.8].map((f, i) => `<path d="M${w * f} 2V${h - 9}" stroke="#cbd5e1" stroke-width="2"/>` + [0.3, 0.5, 0.7].map((g) => rr(w * f - 2.5, (h - 14) * g, 5, 5, 1, i % 2 ? '#ef4444' : '#3b82f6')).join('')).join(''),
  },
  arcade: {
    label: 'Játékautomata', cat: 'fun', w: 46, h: 44, layer: 1, solid: true, actions: ['arcade'],
    draw: (w, h) => box(w, h, '#7c3aed', 6, 4) + rr(6, 4, w - 12, 18, 2, '#0f172a') + `<path d="M12 16L16 10L20 14L26 8L32 13" stroke="#22c55e" stroke-width="1.6" fill="none"/>`
      + circ(14, 29, 3, '#ef4444') + circ(28, 29, 2.5, '#facc15') + circ(34, 29, 2.5, '#22d3ee'),
  },
  dartboard: {
    label: 'Darts tábla', cat: 'fun', w: 30, h: 30, layer: 1, actions: ['darts'],
    draw: () => circ(15, 15, 14, '#1f2937', OL) + circ(15, 15, 11, '#fef3c7') + circ(15, 15, 8, '#16a34a') + circ(15, 15, 5, '#fef3c7') + circ(15, 15, 2.5, '#dc2626'),
  },
  piano: {
    label: 'Zongora', cat: 'fun', w: 90, h: 44, layer: 1, solid: true, actions: ['piano'],
    draw: (w, h) => box(w, h, '#111827', 6, 3) + rr(4, 3, w - 8, 10, 2, '#1f2937') + rr(4, h - 22, w - 8, 12, 1, '#f8fafc')
      + Array.from({ length: 14 }, (_, i) => `<path d="M${4 + (i + 1) * (w - 8) / 15} ${h - 22}V${h - 10}" stroke="#94a3b8" stroke-width=".6"/>`).join('')
      + Array.from({ length: 14 }, (_, i) => ([0, 1, 3, 4, 5].includes(i % 7) ? rr(4 + (i + 1) * (w - 8) / 15 - 1.6, h - 22, 3.2, 7, .5, '#111827') : '')).join(''),
  },
  guitar: {
    label: 'Gitár', cat: 'fun', w: 20, h: 46, layer: 1, actions: ['guitar'],
    draw: () => rr(8, 1, 4, 22, 1, '#78350f') + rr(7, 0, 6, 5, 1, '#451a03') + `<ellipse cx="10" cy="34" rx="9" ry="11" fill="#d97706" ${OL}/>` + `<ellipse cx="10" cy="26" rx="6.5" ry="6" fill="#d97706"/>` + circ(10, 33, 3, '#451a03'),
  },
  disco_ball: {
    label: 'Diszkógömb', cat: 'fun', w: 30, h: 30, layer: 2, actions: ['party'],
    draw: (w, h, c, l, st) => (st?.on ? `<g class="sparkle">${[0, 1, 2, 3, 4, 5].map((i) => circ(15 + 14 * Math.cos(i), 15 + 14 * Math.sin(i), 1.6, ['#f0abfc', '#67e8f9', '#fde047'][i % 3])).join('')}</g>` : '')
      + circ(15, 15, 10, '#cbd5e1', OL) + `<path d="M5 15H25M15 5V25M8 8L22 22M22 8L8 22" stroke="#94a3b8" stroke-width=".8"/>` + circ(11, 11, 2.5, '#fff', 'opacity=".8"'),
  },
  dance_floor: {
    label: 'Táncparkett', cat: 'fun', w: 160, h: 120, layer: 0, resizable: true, actions: ['dance'],
    draw: (w, h) => {
      const cols = ['#db2777', '#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#ca8a04'];
      let s = '';
      const n = 6, m = Math.max(2, Math.round(h / (w / n)));
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) s += rr(i * w / n + 1, j * h / m + 1, w / n - 2, h / m - 2, 2, cols[(i + j * 2) % cols.length], `class="df-tile t${(i + j) % 3}" opacity=".55"`);
      return s;
    },
  },
  balloon: {
    label: 'Lufi', cat: 'fun', w: 20, h: 34, layer: 2, tint: '#ef4444', actions: ['pop'],
    draw: (w, h, c, l, st) => (st?.popped ? `<path d="M6 8L10 4L14 9L9 12Z" fill="${c || '#ef4444'}" opacity=".6"/>` : `<ellipse cx="10" cy="10" rx="8" ry="9.5" fill="${c || '#ef4444'}" ${OL}/><ellipse cx="7" cy="6" rx="2" ry="3" fill="#fff" opacity=".45"/>`)
      + `<path d="M10 19Q7 25 11 29T10 34" stroke="#64748b" stroke-width=".8" fill="none"/>`,
  },
  gong: {
    label: 'Gong', cat: 'fun', w: 40, h: 40, layer: 1, actions: ['gong'],
    draw: () => `<path d="M3 39V5H37V39" stroke="#78350f" stroke-width="3" fill="none"/>` + circ(20, 21, 13, '#ca8a04', OL) + circ(20, 21, 9, '#eab308') + circ(20, 21, 3, '#a16207'),
  },
  cake: {
    label: 'Torta', cat: 'fun', w: 34, h: 30, layer: 2, actions: ['cake'],
    draw: (w, h, c, l, st) => {
      const lit = !st?.blown;
      return `<ellipse cx="17" cy="23" rx="15" ry="5" fill="#e5e7eb" ${OL}/>` + rr(4, 10, 26, 13, 4, '#f9a8d4', OL) + rr(4, 10, 26, 5, 3, '#fff')
        + [10, 17, 24].map((x) => rr(x - 1, 3, 2, 8, 1, '#60a5fa') + (lit ? `<ellipse class="candle" cx="${x}" cy="2" rx="1.6" ry="2.4" fill="#f59e0b"/>` : '')).join('');
    },
  },
  confetti_cannon: {
    label: 'Konfettiágyú', cat: 'fun', w: 26, h: 30, layer: 1, actions: ['confetti'],
    draw: () => `<path d="M8 28L13 4L18 28Z" fill="#a855f7" ${OL}/>` + `<path d="M10 20L16 18M11 14L15 12" stroke="#fde047" stroke-width="1.6"/>` + circ(13, 4, 2.5, '#f472b6') + circ(7, 6, 1.4, '#22d3ee') + circ(19, 3, 1.4, '#fde047'),
  },
  neon_sign: {
    label: 'Neon felirat', cat: 'fun', w: 140, h: 30, layer: 1, tint: '#f0abfc', resizable: true, hasLabel: true, actions: ['toggle'],
    draw: (w, h, c, text, st) => {
      const on = st?.on !== false;
      const col = c || '#f0abfc';
      return rr(0.5, 0.5, w - 1, h - 1, 6, '#0f172a', 'opacity=".85"')
        + `<text x="${w / 2}" y="${h / 2}" fill="${on ? col : '#475569'}" font-size="${Math.max(9, Math.min(h * 0.6, 40))}" font-weight="800" font-family="-apple-system,Segoe UI,sans-serif" text-anchor="middle" dominant-baseline="central" ${on ? `style="filter: drop-shadow(0 0 3px ${col}) drop-shadow(0 0 6px ${col})"` : ''}>${escXml(text || 'Hello!')}</text>`;
    },
  },

  // ============================================================ KONYHA
  kitchen_counter: {
    label: 'Konyhapult', cat: 'kitchen', w: 160, h: 44, layer: 1, solid: true, tint: '#e5e7eb', resizable: true,
    draw: (w, h, c) => {
      let s = box(w, h, c || '#e5e7eb', 7, 3);
      if (w >= 90) s += rr(w * 0.12, 6, 34, h - 20, 4, '#94a3b8', OL) + circ(w * 0.12 + 17, 9, 2, '#475569');
      if (w >= 140) s += [0, 1, 2, 3].map((i) => circ(w - 46 + (i % 2) * 18, 12 + Math.floor(i / 2) * 14, 5.5, '#1f2937', 'stroke="#475569" stroke-width="1.5"')).join('');
      return s;
    },
  },
  kitchen_island: {
    label: 'Konyhasziget', cat: 'kitchen', w: 140, h: 56, layer: 1, solid: true, tint: '#f1f5f9', resizable: true,
    draw: (w, h, c) => box(w, h, c || '#f1f5f9', 9, 4) + rr(4, 4, w - 8, 3, 1.5, '#fff', 'opacity=".6"'),
  },
  sink: {
    label: 'Mosogató', cat: 'kitchen', w: 50, h: 40, layer: 1, solid: true, actions: ['wash'],
    draw: (w, h) => box(w, h, '#e5e7eb', 7, 3) + rr(8, 6, w - 16, h - 20, 6, '#94a3b8', OL) + rr(w / 2 - 2, 2, 4, 8, 2, '#64748b') + circ(w / 2, 14, 1.5, '#475569'),
  },
  fridge: {
    label: 'Hűtő', cat: 'kitchen', w: 46, h: 46, layer: 1, solid: true, actions: ['fridge'],
    draw: (w, h) => box(w, h, '#f1f5f9', 6, 4) + `<path d="M4 ${h * 0.38}H${w - 4}" stroke="#94a3b8" stroke-width="1.5"/>` + rr(w - 10, 6, 3, 8, 1.5, '#94a3b8') + rr(w - 10, h * 0.45, 3, 10, 1.5, '#94a3b8'),
  },
  coffee_machine: {
    label: 'Kávégép', cat: 'kitchen', w: 30, h: 30, layer: 2, actions: ['coffee'],
    draw: (w, h) => box(w, h, '#1f2937', 5, 4) + rr(8, 6, 14, 9, 2, '#475569') + circ(15, 19, 3.5, '#fff', OL) + circ(15, 19, 2, '#78350f') + circ(24, 6, 1.5, '#ef4444'),
  },
  kettle: {
    label: 'Vízforraló', cat: 'kitchen', w: 22, h: 24, layer: 2, actions: ['tea'],
    draw: () => rr(3, 20, 16, 3, 1.5, '#334155') + `<path d="M4 20L5 7H17L18 20Z" fill="#e2e8f0" ${OL}/>` + `<path d="M17 9C22 9 22 16 18 17" stroke="#94a3b8" stroke-width="2" fill="none"/><path d="M5 9L1 6" stroke="#94a3b8" stroke-width="2"/>` + rr(7, 4, 8, 3, 1.5, '#64748b'),
  },
  toaster: {
    label: 'Kenyérpirító', cat: 'kitchen', w: 28, h: 22, layer: 2, actions: ['toast'],
    draw: () => rr(1, 4, 26, 17, 6, '#cbd5e1', OL) + rr(6, 4, 6, 3, 1, '#334155') + rr(16, 4, 6, 3, 1, '#334155') + rr(23, 10, 3, 5, 1, '#475569'),
  },
  microwave: {
    label: 'Mikró', cat: 'kitchen', w: 34, h: 24, layer: 2, actions: ['popcorn'],
    draw: (w, h) => box(w, h, '#475569', 4, 3) + rr(4, 4, 18, h - 12, 2, '#0f172a') + rr(25, 4, 5, h - 12, 1, '#334155'),
  },
  water_cooler: {
    label: 'Vízadagoló', cat: 'kitchen', w: 30, h: 30, layer: 1, solid: true, actions: ['water'],
    draw: () => circ(15, 15, 13.5, '#e2e8f0', OL) + circ(15, 15, 10, '#7dd3fc', 'opacity=".8"') + circ(12, 11, 3, '#fff', 'opacity=".6"'),
  },
  vending_machine: {
    label: 'Automata', cat: 'kitchen', w: 50, h: 50, layer: 1, solid: true, actions: ['vending'],
    draw: (w, h) => box(w, h, '#dc2626', 6, 3) + rr(5, 4, 28, h - 16, 2, '#e0f2fe', 'opacity=".9"')
      + [0, 1, 2].map((r) => [0, 1, 2].map((c2) => rr(8 + c2 * 8, 7 + r * 10, 6, 7, 1, ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#eab308'][(r * 3 + c2) % 5])).join('')).join('')
      + rr(37, 8, 8, 12, 1, '#1f2937') + rr(37, 24, 8, 4, 1, '#0f172a'),
  },
  fruit_bowl: {
    label: 'Gyümölcstál', cat: 'kitchen', w: 30, h: 22, layer: 2, actions: ['fruit'],
    draw: () => `<ellipse cx="15" cy="15" rx="13" ry="6" fill="#d97706" ${OL}/>` + circ(10, 11, 4, '#ef4444') + circ(17, 10, 4, '#84cc16') + `<path d="M19 13C22 6 27 7 28 10C25 10 22 12 21 15Z" fill="#facc15" ${OL}/>` + circ(13, 7, 3, '#f97316'),
  },
  cookie_jar: {
    label: 'Kekszesdoboz', cat: 'kitchen', w: 22, h: 24, layer: 2, actions: ['cookie'],
    draw: () => rr(2, 6, 18, 17, 6, '#e0f2fe', OL) + rr(4, 2, 14, 5, 2, '#b45309', OL) + circ(8, 15, 3, '#a16207') + circ(14, 17, 3, '#ca8a04') + circ(12, 11, 2.5, '#92400e'),
  },
  pizza_box: {
    label: 'Pizza', cat: 'kitchen', w: 36, h: 36, layer: 2, actions: ['pizza'],
    draw: (w, h, c, l, st) => {
      const left = Math.max(0, 8 - (st?.taken || 0));
      let s = rr(1, 1, 34, 34, 2, '#d6b98c', OL) + circ(18, 18, 14, '#f59e0b');
      for (let i = 0; i < 8; i++) {
        if (i >= left) continue;
        const a = (i / 8) * Math.PI * 2, b = ((i + 1) / 8) * Math.PI * 2;
        s += `<path d="M18 18L${18 + 13 * Math.cos(a)} ${18 + 13 * Math.sin(a)}A13 13 0 0 1 ${18 + 13 * Math.cos(b)} ${18 + 13 * Math.sin(b)}Z" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/>` + circ(18 + 8 * Math.cos(a + 0.4), 18 + 8 * Math.sin(a + 0.4), 1.8, '#dc2626');
      }
      return s;
    },
  },
  dining_table: {
    label: 'Étkezőasztal', cat: 'kitchen', w: 120, h: 70, layer: 1, solid: true, tint: '#d4a373', resizable: true,
    draw: (w, h, c) => box(w, h, c || '#d4a373', 7, 6),
  },
  bar_stool: {
    label: 'Bárszék', cat: 'kitchen', w: 24, h: 24, layer: 1, tint: '#334155', ...SIT([[0.5, 0.5]]), actions: ['sit'],
    draw: (w, h, c) => circ(12, 12, 10, '#94a3b8', 'opacity=".4"') + circ(12, 12, 8, c || '#334155', OL) + circ(10, 10, 3, '#fff', 'opacity=".2"'),
  },

  // ============================================================ KERT
  tree: {
    label: 'Fa', cat: 'garden', w: 70, h: 80, layer: 1, solid: true,
    draw: () => rr(29, 50, 12, 28, 3, '#78350f', OL) + `<ellipse cx="35" cy="76" rx="18" ry="4" fill="rgba(0,0,0,.25)"/>` + [[35, 30, 26], [18, 38, 16], [52, 38, 16], [35, 14, 16]].map(([x, y, r]) => circ(x, y, r, '#15803d', OL)).join('') + circ(28, 22, 7, '#4ade80', 'opacity=".4"'),
  },
  bush: {
    label: 'Bokor', cat: 'garden', w: 50, h: 34, layer: 1, solid: true,
    draw: () => [[12, 20, 11], [25, 15, 13], [38, 20, 11]].map(([x, y, r]) => circ(x, y, r, '#166534', OL)).join('') + circ(21, 11, 4, '#4ade80', 'opacity=".4"'),
  },
  flower_bed: {
    label: 'Virágágyás', cat: 'garden', w: 100, h: 36, layer: 1, solid: true, resizable: true, actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const status = plantStatus(st).status;
      const fl = status === 'dying' ? ['#a16207'] : ['#ec4899', '#facc15', '#f97316', '#a855f7', '#fff'];
      return rr(0.5, 0.5, w - 1, h - 1, 4, '#78350f', OL) + rr(4, 4, w - 8, h - 10, 3, '#57340f')
        + Array.from({ length: Math.floor(w / 12) }, (_, i) => circ(9 + i * 12, 10 + (i % 2) * 8, 3.5, leafOf(st)) + circ(9 + i * 12, 9 + (i % 2) * 8, 2.4, fl[i % fl.length])).join('');
    },
  },
  parasol_table: {
    label: 'Napernyős asztal', cat: 'garden', w: 80, h: 80, layer: 1, solid: true, tint: '#ef4444',
    draw: (w, h, c) => {
      const col = c || '#ef4444';
      return `<ellipse cx="40" cy="44" rx="22" ry="18" fill="#e5e7eb" ${OL}/>` + circ(40, 38, 32, col, 'opacity=".92"')
        + Array.from({ length: 8 }, (_, i) => `<path d="M40 38L${40 + 32 * Math.cos(i * Math.PI / 4)} ${38 + 32 * Math.sin(i * Math.PI / 4)}" stroke="#fff" stroke-width="1.2" opacity=".6"/>`).join('') + circ(40, 38, 3, '#fff');
    },
  },
  grill: {
    label: 'Grill', cat: 'garden', w: 40, h: 36, layer: 1, solid: true, actions: ['grill'],
    draw: () => `<path d="M8 33L12 22M32 33L28 22" stroke="#334155" stroke-width="2"/>` + `<ellipse cx="20" cy="15" rx="17" ry="11" fill="#1f2937" ${OL}/>`
      + `<path d="M7 13H33M9 18H31M8 8H32" stroke="#64748b" stroke-width="1.2"/>` + rr(11, 9, 8, 3, 1.5, '#b45309') + rr(21, 14, 8, 3, 1.5, '#b45309'),
  },
  lounge_chair: {
    label: 'Nyugágy', cat: 'garden', w: 40, h: 86, layer: 1, tint: '#0ea5e9', seats: [[0.5, 0.45]], pose: 'lie', actions: ['lie'],
    draw: (w, h, c) => rr(3, 2, w - 6, h - 4, 4, '#e5e7eb', OL) + rr(6, 5, w - 12, h - 10, 3, c || '#0ea5e9') + Array.from({ length: 6 }, (_, i) => `<path d="M6 ${12 + i * 12}H${w - 6}" stroke="#fff" stroke-width="2" opacity=".5"/>`).join(''),
  },
  fountain: {
    label: 'Szökőkút', cat: 'garden', w: 90, h: 90, layer: 1, solid: true, actions: ['wish'],
    draw: () => circ(45, 45, 43, '#94a3b8', OL) + circ(45, 45, 36, '#38bdf8') + `<g class="ripple">${circ(45, 45, 20, 'none', 'stroke="#e0f2fe" stroke-width="1.5" opacity=".6"')}${circ(45, 45, 28, 'none', 'stroke="#e0f2fe" stroke-width="1" opacity=".4"')}</g>`
      + circ(45, 45, 9, '#cbd5e1', OL) + circ(45, 45, 4, '#e0f2fe'),
  },
  fence: {
    label: 'Kerítés', cat: 'garden', w: 120, h: 12, layer: 3, solid: true, resizable: true,
    draw: (w, h) => rr(0, h / 2 - 2, w, 4, 1, '#a16207') + Array.from({ length: Math.floor(w / 12) + 1 }, (_, i) => rr(i * 12, 0, 5, h, 1.5, '#d97706', OL)).join(''),
  },

  // ============================================================ DÍSZ
  plant: {
    label: 'Növény', cat: 'decor', w: 36, h: 36, layer: 1, actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const s = plantStatus(st).status, lc = leafOf(st), droop = s === 'dying' || s === 'over' ? 4 : s === 'thirsty' ? 2 : 0;
      return (s === 'over' ? `<ellipse cx="18" cy="34" rx="14" ry="3" fill="#38bdf8" opacity=".6"/>` : '') + rr(10, 22, 16, 13, 3, '#b45309', OL)
        + [[18, 13, 9], [10, 16, 6.5], [26, 16, 6.5], [18, 6, 6]].map(([x, y, r]) => circ(x, y + droop, r - droop / 3, lc, OL)).join('') + (s === 'good' ? circ(15, 10, 2.5, '#4ade80', 'opacity=".6"') : '');
    },
  },
  big_plant: {
    label: 'Nagy növény', cat: 'decor', w: 54, h: 54, layer: 1, solid: true, actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const s = plantStatus(st).status, lc = leafOf(st), droop = s === 'dying' || s === 'over' ? 5 : s === 'thirsty' ? 2 : 0;
      return (s === 'over' ? `<ellipse cx="27" cy="52" rx="20" ry="3" fill="#38bdf8" opacity=".6"/>` : '') + rr(17, 36, 20, 17, 4, '#57534e', OL)
        + [[27, 20, 14], [14, 24, 10], [40, 24, 10], [27, 8, 9], [16, 12, 7], [38, 12, 7]].map(([x, y, r]) => circ(x, y + droop, r - droop / 3, lc, OL)).join('');
    },
  },
  monstera: {
    label: 'Monstera', cat: 'decor', w: 46, h: 50, layer: 1, actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const lc = leafOf(st);
      return rr(14, 34, 18, 15, 4, '#e7e5e4', OL) + [[-35, 14, 18], [10, 32, 16], [-5, 22, 8], [40, 14, 20]].map(([a, x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" transform="rotate(${a} ${x} ${y})" fill="${lc}" ${OL}/>`).join('')
        + `<path d="M23 34V20M23 28L14 19M23 26L33 18" stroke="${shade(lc, -0.3)}" stroke-width="1.2"/>`;
    },
  },
  bonsai: {
    label: 'Bonsai', cat: 'decor', w: 30, h: 26, layer: 2, actions: ['waterplant'],
    draw: (w, h, c, l, st) => rr(4, 18, 22, 7, 2, '#1e3a8a', OL) + `<path d="M15 18C14 13 18 12 16 8" stroke="#78350f" stroke-width="2.5" fill="none"/>` + [[10, 9, 5], [17, 6, 5.5], [22, 10, 4]].map(([x, y, r]) => circ(x, y, r, leafOf(st), OL)).join(''),
  },
  cactus: {
    label: 'Kaktusz', cat: 'decor', w: 22, h: 30, layer: 2, actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const s = plantStatus({ ...st, m: st?.m ?? 80 }).status;
      const col = s === 'over' ? '#a3b818' : s === 'dying' ? '#a16207' : '#16a34a';
      return rr(4, 20, 14, 9, 2, '#c2410c', OL) + rr(8, 3, 6, 19, 3, col, OL) + rr(3, 9, 5, 7, 2.5, col, OL) + rr(14, 6, 5, 8, 2.5, col, OL);
    },
  },
  flowers: {
    label: 'Virág', cat: 'decor', w: 28, h: 30, layer: 2, tint: '#ec4899', actions: ['waterplant'],
    draw: (w, h, c, l, st) => {
      const s = plantStatus(st).status;
      const petal = s === 'dying' ? '#a16207' : c || '#ec4899';
      const dy = s === 'dying' || s === 'over' ? 3 : 0;
      return rr(7, 19, 14, 10, 3, '#e5e7eb', OL) + `<path d="M14 19V${9 + dy}M10 19L${7 + dy} ${11 + dy}M18 19L${21 - dy} ${11 + dy}" stroke="${leafOf(st)}" stroke-width="1.6"/>`
        + [[14, 7], [7, 10], [21, 10]].map(([x, y]) => circ(x + (x < 14 ? dy : x > 14 ? -dy : 0), y + dy, 4, petal, OL) + circ(x + (x < 14 ? dy : x > 14 ? -dy : 0), y + dy, 1.5, '#fde047')).join('');
    },
  },
  picture: {
    label: 'Kép', cat: 'decor', w: 44, h: 32, layer: 1, actions: ['picture'],
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#92400e', OL) + rr(4, 4, w - 8, h - 8, 1, '#7dd3fc')
      + `<path d="M4 ${h - 4}L${w * 0.35} ${h * 0.45}L${w * 0.6} ${h * 0.7}L${w * 0.75} ${h * 0.55}L${w - 4} ${h - 4}Z" fill="#16a34a"/>` + circ(w * 0.72, h * 0.32, 3, '#fde047'),
  },
  mirror: {
    label: 'Tükör', cat: 'decor', w: 30, h: 44, layer: 1, actions: ['mirror'],
    draw: () => `<ellipse cx="15" cy="22" rx="14" ry="21" fill="#a16207" ${OL}/>` + `<ellipse cx="15" cy="22" rx="11" ry="18" fill="#bae6fd"/>` + `<path d="M8 12L13 8M8 18L17 10" stroke="#fff" stroke-width="1.5" opacity=".7"/>`,
  },
  clock: {
    label: 'Óra', cat: 'decor', w: 26, h: 26, layer: 1, actions: ['clock'], ticking: true,
    draw: () => {
      const d = new Date();
      const ha = ((d.getHours() % 12) + d.getMinutes() / 60) * 30 * Math.PI / 180, ma = d.getMinutes() * 6 * Math.PI / 180;
      return circ(13, 13, 12, '#f8fafc', 'stroke="#334155" stroke-width="2"')
        + `<path d="M13 13L${13 + 5.5 * Math.sin(ha)} ${13 - 5.5 * Math.cos(ha)}M13 13L${13 + 8.5 * Math.sin(ma)} ${13 - 8.5 * Math.cos(ma)}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>` + circ(13, 13, 1.2, '#dc2626');
    },
  },
  trash: {
    label: 'Szemetes', cat: 'decor', w: 20, h: 20, layer: 1, actions: ['trash'],
    draw: () => circ(10, 10, 9, '#64748b', OL) + circ(10, 10, 6.5, '#334155'),
  },
  label: {
    label: 'Felirat', cat: 'decor', w: 140, h: 30, layer: 2, tint: '#0f172a', resizable: true, hasLabel: true,
    draw: (w, h, c, text) => rr(0.5, 0.5, w - 1, h - 1, 6, c || '#0f172a', 'opacity=".75"')
      + `<text x="${w / 2}" y="${h / 2}" fill="#fff" font-size="${Math.max(9, Math.min(h * 0.55, 40))}" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif" text-anchor="middle" dominant-baseline="central">${escXml(text || 'Felirat')}</text>`,
  },

  // ============================================================ FAL, AJTÓ
  wall: {
    label: 'Fal', cat: 'structure', w: 200, h: 14, layer: 3, solid: true, tint: '#475569', resizable: true,
    draw: (w, h, c) => rr(0, 0, w, h, 1.5, shade(c || '#475569', -0.3)) + rr(0, 0, w, Math.max(3, h - 4), 1.5, c || '#475569') + rr(0, 0, w, 2, 1, '#fff', 'opacity=".14"'),
  },
  glass_wall: {
    label: 'Üvegfal', cat: 'structure', w: 160, h: 10, layer: 3, solid: true, resizable: true,
    draw: (w, h) => rr(0, 0, w, h, 1, '#bae6fd', 'opacity=".45"') + rr(0, 0, w, h, 1, 'none', 'stroke="#e0f2fe" stroke-width="1.5"')
      + Array.from({ length: Math.floor(w / 60) }, (_, i) => rr((i + 1) * 60 - 1, 0, 2, h, 0, '#94a3b8')).join('') + `<path d="M6 ${h - 3}L18 2" stroke="#fff" stroke-width="1" opacity=".7"/>`,
  },
  window: {
    label: 'Ablak', cat: 'structure', w: 120, h: 14, layer: 3, solid: true, resizable: true, actions: ['window'],
    draw: (w, h) => rr(0, 0, w, h, 2, '#64748b') + rr(3, 3, w - 6, h - 6, 1, '#bae6fd') + `<path d="M${w / 2} 3V${h - 3}" stroke="#64748b" stroke-width="2"/>` + rr(6, 4, w * 0.25, 2, 1, '#fff', 'opacity=".7"'),
  },
  door: {
    label: 'Ajtó', cat: 'structure', w: 60, h: 14, layer: 3, door: true, actions: ['door'],
    draw: (w, h, c, l, st) => drawDoor(w, h, st, 1),
  },
  double_door: {
    label: 'Kétszárnyú ajtó', cat: 'structure', w: 100, h: 14, layer: 3, door: true, actions: ['door'],
    draw: (w, h, c, l, st) => drawDoor(w, h, st, 2),
  },
  glass_door: {
    label: 'Üvegajtó', cat: 'structure', w: 60, h: 10, layer: 3, door: true, actions: ['door'],
    draw: (w, h, c, l, st) => drawDoor(w, h, st, 1, true),
  },
  arch: {
    label: 'Boltív (nyitott átjáró)', cat: 'structure', w: 100, h: 14, layer: 3, resizable: true,
    draw: (w, h) => rr(0, 0, 10, h, 2, '#64748b', OL) + rr(w - 10, 0, 10, h, 2, '#64748b', OL)
      + `<path d="M8 ${h / 2}Q${w / 2} ${-h * 1.4} ${w - 8} ${h / 2}" stroke="#94a3b8" stroke-width="3" fill="none" stroke-dasharray="1 0"/>`,
  },
  pillar: {
    label: 'Oszlop', cat: 'structure', w: 30, h: 30, layer: 1, solid: true,
    draw: (w, h) => box(w, h, '#94a3b8', 5, 3),
  },
  radiator: {
    label: 'Radiátor', cat: 'structure', w: 70, h: 14, layer: 1, solid: true, actions: ['radiator'],
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 3, '#e5e7eb', OL) + Array.from({ length: Math.floor(w / 7) }, (_, i) => rr(3 + i * 7, 2, 4, h - 4, 2, '#cbd5e1')).join(''),
  },
  elevator: {
    label: 'Lift', cat: 'structure', w: 70, h: 20, layer: 3, solid: true, actions: ['elevator'],
    draw: (w, h) => rr(0, 0, w, h, 2, '#475569', OL) + rr(6, 3, w / 2 - 7, h - 6, 1, '#cbd5e1') + rr(w / 2 + 1, 3, w / 2 - 7, h - 6, 1, '#cbd5e1') + circ(w - 3, h / 2, 1.6, '#fde047'),
  },
};

function drawDoor(w, h, st, leaves, glass = false) {
  const open = !!st?.open && !st?.locked;
  const frame = rr(0, 0, 5, h, 1, '#475569') + rr(w - 5, 0, 5, h, 1, '#475569');
  const leafCol = glass ? '#bae6fd' : '#b45309';
  if (open) {
    // nyitott ajtó: a szárny(ak) 90°-ban kifordulva
    const lw = (w - 10) / leaves;
    let s = rr(5, 0, w - 10, h, 0, 'rgba(255,255,255,.06)') + frame;
    s += rr(5, h, 4, lw * 0.9, 1, leafCol, OL);
    if (leaves === 2) s += rr(w - 9, h, 4, lw * 0.9, 1, leafCol, OL);
    return s;
  }
  let s = frame + rr(5, 1, w - 10, h - 2, 1, glass ? '#bae6fd' : '#92400e', glass ? 'opacity=".7"' : OL);
  if (!glass) s += rr(8, 3, (w - 16) / leaves - 2, h - 6, 1, '#b45309') + (leaves === 2 ? rr(w / 2 + 1, 3, (w - 16) / 2 - 2, h - 6, 1, '#b45309') : '');
  if (leaves === 2) s += `<path d="M${w / 2} 1V${h - 1}" stroke="#451a03" stroke-width="1"/>`;
  s += circ(leaves === 2 ? w / 2 - 4 : w - 11, h / 2, 1.8, '#fde047');
  if (st?.locked) s += `<g transform="translate(${w / 2 - 6} ${h / 2 - 8})">${rr(2, 6, 10, 9, 2, '#facc15', OL)}<path d="M4 7V4.5a3 3 0 0 1 6 0V7" stroke="#facc15" stroke-width="2" fill="none"/></g>`;
  return s;
}

// ---------------------------------------------------------------- segédfüggvények

/** A tárgy tényleges befoglaló téglalapja elforgatás után. */
export function itemBox(it) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  if (it.rot === 90 || it.rot === 270) return { x: cx - it.h / 2, y: cy - it.w / 2, w: it.h, h: it.w };
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}

const ROT_DIR = { down: ['down', 'left', 'up', 'right'], up: ['up', 'right', 'down', 'left'] };

/** Ülőhelyek abszolút koordinátákkal és nézési iránnyal. */
export function seatsOf(it) {
  const def = CATALOG[it.type];
  if (!def?.seats) return [];
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  const r = ((it.rot || 0) / 90) % 4;
  return def.seats.map(([fx, fy]) => {
    let dx = it.x + fx * it.w - cx, dy = it.y + fy * it.h - cy;
    for (let i = 0; i < r; i++) [dx, dy] = [-dy, dx];
    return { x: cx + dx, y: cy + dy, dir: ROT_DIR.down[r], pose: def.pose || 'sit' };
  });
}

export function itemSVG(it, st) {
  const def = CATALOG[it.type];
  if (!def) return '';
  const w = it.w || def.w, h = it.h || def.h;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${def.draw(w, h, it.color || def.tint || '', it.label, st || {})}</svg>`;
}

// Ikon a szerkesztő palettájához
export function previewSVG(type) {
  const def = CATALOG[type];
  const w = def.w, h = def.h;
  return `<svg viewBox="-2 -2 ${w + 4} ${h + 4}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${def.draw(w, h, def.tint || '', 'Abc', { on: true })}</svg>`;
}

export function newUid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-6);
}
