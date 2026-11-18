// Bútorok és díszek katalógusa. Minden rajz saját, kódból generált SVG
// (enyhén felülről, "3/4" nézetben), így nincs szükség külső képekre.

import { shade } from './avatar.js';

const OL = 'stroke="rgba(0,0,0,.35)" stroke-width="1"';
const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="${r}" fill="${fill}" ${extra}/>`;

// Doboz vastagsággal: alul sötétebb perem, felül a lap.
function box(w, h, c, depth = 6, r = 4) {
  return rr(0.5, 0.5, w - 1, h - 1, r, shade(c, -0.3), OL) + rr(0.5, 0.5, w - 1, h - depth - 1, r, c, OL);
}

function wood(c) { return c || '#b07a4a'; }

const BOOK = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#64748b'];

export const CATEGORIES = [
  ['office', 'Iroda'],
  ['lounge', 'Pihenő'],
  ['kitchen', 'Konyha'],
  ['decor', 'Dísz'],
  ['structure', 'Fal, ajtó'],
];

// layer: 0 = padlón (szőnyeg), 1 = bútor, 2 = asztalon lévő tárgy
export const CATALOG = {
  desk: {
    label: 'Íróasztal', cat: 'office', w: 120, h: 60, layer: 1, tint: '#b07a4a', resizable: true,
    draw: (w, h, c) => box(w, h, wood(c), 8) + rr(4, 4, w - 8, 2, 1, '#fff', 'opacity=".18"'),
  },
  desk_white: {
    label: 'Fehér asztal', cat: 'office', w: 110, h: 56, layer: 1, tint: '#e5e7eb', resizable: true,
    draw: (w, h, c) => box(w, h, c || '#e5e7eb', 7) + rr(w - 14, h - 6, 8, 6, 1, '#94a3b8'),
  },
  meeting_table: {
    label: 'Tárgyalóasztal', cat: 'office', w: 200, h: 90, layer: 1, tint: '#8b5a2b', resizable: true,
    draw: (w, h, c) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${h / 2.2}" fill="${shade(wood(c), -0.3)}" ${OL}/>`
      + `<rect x="1" y="1" width="${w - 2}" height="${h - 10}" rx="${h / 2.4}" fill="${wood(c)}" ${OL}/>`
      + `<rect x="${w * 0.15}" y="${h * 0.22}" width="${w * 0.7}" height="3" rx="1.5" fill="#fff" opacity=".15"/>`,
  },
  round_table: {
    label: 'Kerek asztal', cat: 'office', w: 80, h: 80, layer: 1, tint: '#b07a4a', resizable: true,
    draw: (w, h, c) => `<ellipse cx="${w / 2}" cy="${h / 2 + 3}" rx="${w / 2 - 1}" ry="${h / 2 - 4}" fill="${shade(wood(c), -0.3)}" ${OL}/>`
      + `<ellipse cx="${w / 2}" cy="${h / 2 - 2}" rx="${w / 2 - 1}" ry="${h / 2 - 4}" fill="${wood(c)}" ${OL}/>`,
  },
  chair: {
    label: 'Szék', cat: 'office', w: 32, h: 32, layer: 1, tint: '#2563eb',
    draw: (w, h, c) => rr(5, 9, 22, 20, 6, c || '#2563eb', OL) + rr(4, 2, 24, 9, 4, shade(c || '#2563eb', -0.25), OL),
  },
  office_chair: {
    label: 'Irodai szék', cat: 'office', w: 34, h: 34, layer: 1, tint: '#1f2937',
    draw: (w, h, c) => {
      const col = c || '#1f2937';
      return `<g stroke="#475569" stroke-width="2.4" stroke-linecap="round"><path d="M17 22L5 31M17 22L29 31M17 22L17 33"/></g>`
        + `<circle cx="17" cy="19" r="11" fill="${col}" ${OL}/>` + rr(6, 2, 22, 10, 5, shade(col, 0.15), OL);
    },
  },
  laptop: {
    label: 'Laptop', cat: 'office', w: 30, h: 22, layer: 2,
    draw: (w, h) => rr(1, 1, w - 2, 12, 2, '#475569', OL) + rr(3, 2.5, w - 6, 9, 1, '#60a5fa') + rr(4, 3.5, 8, 2, 1, '#fff', 'opacity=".35"')
      + rr(0.5, 12, w - 1, h - 12.5, 2, '#cbd5e1', OL) + rr(w / 2 - 4, h - 4, 8, 2, 1, '#94a3b8'),
  },
  monitor: {
    label: 'Monitor', cat: 'office', w: 42, h: 30, layer: 2,
    draw: (w, h) => rr(w / 2 - 3, h - 8, 6, 6, 1, '#334155') + rr(w / 2 - 9, h - 3, 18, 3, 1.5, '#334155')
      + rr(0.5, 0.5, w - 1, h - 8, 2.5, '#111827', OL) + rr(3, 3, w - 6, h - 13, 1, '#0ea5e9') + rr(5, 5, 10, 3, 1, '#fff', 'opacity=".3"'),
  },
  keyboard: {
    label: 'Billentyűzet', cat: 'office', w: 30, h: 10, layer: 2,
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#e2e8f0', OL) + [2.5, 5.5].map((y) => `<path d="M3 ${y + 0.5}H${w - 3}" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="2 1.2"/>`).join(''),
  },
  papers: {
    label: 'Papírok', cat: 'office', w: 24, h: 18, layer: 2,
    draw: () => `<rect x="3" y="2" width="15" height="14" fill="#f8fafc" transform="rotate(-8 10 9)" ${OL}/><rect x="7" y="2" width="15" height="14" fill="#fff" transform="rotate(6 14 9)" ${OL}/>`
      + `<path d="M10 6H19M10 9H19M10 12H16" stroke="#94a3b8" stroke-width="1" transform="rotate(6 14 9)"/>`,
  },
  mug: {
    label: 'Bögre', cat: 'office', w: 12, h: 12, layer: 2, tint: '#ef4444',
    draw: (w, h, c) => `<circle cx="5.5" cy="6" r="5" fill="${c || '#ef4444'}" ${OL}/><circle cx="5.5" cy="6" r="3" fill="#78350f"/><path d="M10 4.5Q12.5 6 10 8" stroke="${c || '#ef4444'}" stroke-width="1.8" fill="none"/>`,
  },
  cabinet: {
    label: 'Iratszekrény', cat: 'office', w: 44, h: 50, layer: 1, tint: '#94a3b8',
    draw: (w, h, c) => box(w, h, c || '#94a3b8', 5, 3) + [0.28, 0.58].map((f) => rr(5, h * f, w - 10, 2, 1, shade(c || '#94a3b8', -0.25)) + rr(w / 2 - 5, h * f - 6, 10, 3, 1.5, '#e2e8f0')).join(''),
  },
  bookshelf: {
    label: 'Könyvespolc', cat: 'office', w: 100, h: 36, layer: 1, tint: '#8b5a2b', resizable: true,
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
    label: 'Nyomtató', cat: 'office', w: 44, h: 34, layer: 1,
    draw: (w, h) => box(w, h, '#e5e7eb', 6, 4) + rr(8, 4, w - 16, 9, 2, '#334155') + rr(11, 1, w - 22, 6, 1, '#fff', OL) + `<circle cx="${w - 8}" cy="${h - 13}" r="2" fill="#22c55e"/>`,
  },
  whiteboard: {
    label: 'Tábla', cat: 'office', w: 120, h: 26, layer: 1, resizable: true,
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#94a3b8', OL) + rr(3, 3, w - 6, h - 9, 1, '#fff')
      + `<path d="M10 ${h * 0.35}Q20 ${h * 0.15} 30 ${h * 0.4}T50 ${h * 0.3}" stroke="#2563eb" stroke-width="1.6" fill="none"/>`
      + `<path d="M${w * 0.55} ${h * 0.25}H${w * 0.85}M${w * 0.55} ${h * 0.45}H${w * 0.75}" stroke="#ef4444" stroke-width="1.6"/>`
      + rr(w / 2 - 12, h - 5, 24, 3, 1, '#64748b'),
  },
  tv: {
    label: 'Kijelző / TV', cat: 'office', w: 110, h: 64, layer: 1, resizable: true,
    draw: (w, h) => rr(w / 2 - 4, h - 10, 8, 8, 1, '#334155') + rr(w / 2 - 18, h - 4, 36, 4, 2, '#334155')
      + rr(0.5, 0.5, w - 1, h - 10, 3, '#0f172a', OL) + rr(4, 4, w - 8, h - 18, 1, '#1e3a8a')
      + `<path d="M8 ${h - 18}L${w * 0.3} ${h * 0.35}L${w * 0.5} ${h * 0.55}L${w * 0.7} ${h * 0.25}L${w - 8} ${h - 18}Z" fill="#3b82f6" opacity=".5"/>`,
  },

  sofa: {
    label: 'Kanapé', cat: 'lounge', w: 120, h: 52, layer: 1, tint: '#64748b', resizable: true,
    draw: (w, h, c) => {
      const col = c || '#64748b';
      return rr(0.5, 0.5, w - 1, 18, 6, shade(col, -0.2), OL) + rr(0.5, 12, w - 1, h - 12.5, 6, col, OL)
        + rr(0.5, 8, 14, h - 8.5, 5, shade(col, -0.1), OL) + rr(w - 14.5, 8, 14, h - 8.5, 5, shade(col, -0.1), OL)
        + `<path d="M${w / 2} 16V${h - 6}" stroke="${shade(col, -0.25)}" stroke-width="1.5"/>`;
    },
  },
  armchair: {
    label: 'Fotel', cat: 'lounge', w: 52, h: 50, layer: 1, tint: '#0d9488',
    draw: (w, h, c) => {
      const col = c || '#0d9488';
      return rr(0.5, 0.5, w - 1, 18, 6, shade(col, -0.2), OL) + rr(6, 12, w - 12, h - 12.5, 6, col, OL)
        + rr(0.5, 8, 11, h - 8.5, 5, shade(col, -0.1), OL) + rr(w - 11.5, 8, 11, h - 8.5, 5, shade(col, -0.1), OL);
    },
  },
  beanbag: {
    label: 'Babzsák', cat: 'lounge', w: 44, h: 42, layer: 1, tint: '#f59e0b',
    draw: (w, h, c) => `<path d="M6 30C0 18 8 3 22 3S44 16 38 30C35 39 9 39 6 30Z" fill="${c || '#f59e0b'}" ${OL}/><ellipse cx="22" cy="24" rx="11" ry="7" fill="${shade(c || '#f59e0b', -0.15)}"/><ellipse cx="15" cy="11" rx="5" ry="2.5" fill="#fff" opacity=".25"/>`,
  },
  coffee_table: {
    label: 'Dohányzóasztal', cat: 'lounge', w: 70, h: 40, layer: 1, tint: '#a16207', resizable: true,
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
  pingpong: {
    label: 'Pingpongasztal', cat: 'lounge', w: 160, h: 90, layer: 1,
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 3, '#14532d', OL) + rr(0.5, 0.5, w - 1, h - 7, 3, '#15803d', OL)
      + rr(4, 4, w - 8, h - 15, 1, 'none', 'stroke="#fff" stroke-width="1.5"') + `<path d="M${w / 2} 2V${h - 6}" stroke="#e5e7eb" stroke-width="3"/><path d="M4 ${(h - 7) / 2}H${w - 4}" stroke="#fff" stroke-width="1"/>`,
  },
  floor_lamp: {
    label: 'Állólámpa', cat: 'lounge', w: 30, h: 30, layer: 1,
    draw: () => `<circle cx="15" cy="15" r="14" fill="#fde68a" opacity=".25"/><circle cx="15" cy="15" r="9" fill="#fef3c7" ${OL}/><circle cx="15" cy="15" r="3" fill="#f59e0b"/>`,
  },

  kitchen_counter: {
    label: 'Konyhapult', cat: 'kitchen', w: 160, h: 44, layer: 1, tint: '#e5e7eb', resizable: true,
    draw: (w, h, c) => {
      let s = box(w, h, c || '#e5e7eb', 7, 3);
      if (w >= 90) s += rr(w * 0.12, 6, 34, h - 20, 4, '#94a3b8', OL) + `<circle cx="${w * 0.12 + 17}" cy="9" r="2" fill="#475569"/>`;
      if (w >= 140) s += [0, 1, 2, 3].map((i) => `<circle cx="${w - 46 + (i % 2) * 18}" cy="${12 + Math.floor(i / 2) * 14}" r="5.5" fill="#1f2937" stroke="#475569" stroke-width="1.5"/>`).join('');
      return s;
    },
  },
  fridge: {
    label: 'Hűtő', cat: 'kitchen', w: 46, h: 46, layer: 1,
    draw: (w, h) => box(w, h, '#f1f5f9', 6, 4) + `<path d="M4 ${h * 0.38}H${w - 4}" stroke="#94a3b8" stroke-width="1.5"/>` + rr(w - 10, 6, 3, 8, 1.5, '#94a3b8') + rr(w - 10, h * 0.45, 3, 10, 1.5, '#94a3b8'),
  },
  coffee_machine: {
    label: 'Kávégép', cat: 'kitchen', w: 30, h: 30, layer: 2,
    draw: (w, h) => box(w, h, '#1f2937', 5, 4) + rr(8, 6, 14, 9, 2, '#475569') + `<circle cx="15" cy="19" r="3.5" fill="#fff" ${OL}/><circle cx="15" cy="19" r="2" fill="#78350f"/>` + `<circle cx="24" cy="6" r="1.5" fill="#ef4444"/>`,
  },
  water_cooler: {
    label: 'Vízadagoló', cat: 'kitchen', w: 30, h: 30, layer: 1,
    draw: () => `<circle cx="15" cy="15" r="13.5" fill="#e2e8f0" ${OL}/><circle cx="15" cy="15" r="10" fill="#7dd3fc" opacity=".8"/><circle cx="12" cy="11" r="3" fill="#fff" opacity=".6"/>`,
  },
  microwave: {
    label: 'Mikró', cat: 'kitchen', w: 34, h: 24, layer: 2,
    draw: (w, h) => box(w, h, '#475569', 4, 3) + rr(4, 4, 18, h - 12, 2, '#0f172a') + rr(25, 4, 5, h - 12, 1, '#334155'),
  },
  dining_table: {
    label: 'Étkezőasztal', cat: 'kitchen', w: 120, h: 70, layer: 1, tint: '#d4a373', resizable: true,
    draw: (w, h, c) => box(w, h, c || '#d4a373', 7, 6),
  },

  plant: {
    label: 'Növény', cat: 'decor', w: 36, h: 36, layer: 1,
    draw: () => rr(10, 22, 16, 13, 3, '#b45309', OL) + [[18, 13, 9], [10, 16, 6.5], [26, 16, 6.5], [18, 6, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#16a34a" ${OL}/>`).join('') + `<circle cx="15" cy="10" r="2.5" fill="#4ade80" opacity=".6"/>`,
  },
  big_plant: {
    label: 'Nagy növény', cat: 'decor', w: 54, h: 54, layer: 1,
    draw: () => rr(17, 36, 20, 17, 4, '#57534e', OL) + [[27, 20, 14], [14, 24, 10], [40, 24, 10], [27, 8, 9], [16, 12, 7], [38, 12, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#15803d" ${OL}/>`).join('') + `<circle cx="22" cy="14" r="4" fill="#4ade80" opacity=".5"/>`,
  },
  cactus: {
    label: 'Kaktusz', cat: 'decor', w: 22, h: 30, layer: 2,
    draw: () => rr(4, 20, 14, 9, 2, '#c2410c', OL) + rr(8, 3, 6, 19, 3, '#16a34a', OL) + rr(3, 9, 5, 7, 2.5, '#16a34a', OL) + rr(14, 6, 5, 8, 2.5, '#16a34a', OL),
  },
  flowers: {
    label: 'Virág', cat: 'decor', w: 28, h: 30, layer: 2, tint: '#ec4899',
    draw: (w, h, c) => rr(7, 19, 14, 10, 3, '#e5e7eb', OL) + `<path d="M14 19V9M10 19L7 11M18 19L21 11" stroke="#16a34a" stroke-width="1.6"/>`
      + [[14, 7], [7, 10], [21, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c || '#ec4899'}" ${OL}/><circle cx="${x}" cy="${y}" r="1.5" fill="#fde047"/>`).join(''),
  },
  picture: {
    label: 'Kép', cat: 'decor', w: 44, h: 32, layer: 1,
    draw: (w, h) => rr(0.5, 0.5, w - 1, h - 1, 2, '#92400e', OL) + rr(4, 4, w - 8, h - 8, 1, '#7dd3fc')
      + `<path d="M4 ${h - 4}L${w * 0.35} ${h * 0.45}L${w * 0.6} ${h * 0.7}L${w * 0.75} ${h * 0.55}L${w - 4} ${h - 4}Z" fill="#16a34a"/><circle cx="${w * 0.72}" cy="${h * 0.32}" r="3" fill="#fde047"/>`,
  },
  clock: {
    label: 'Óra', cat: 'decor', w: 26, h: 26, layer: 1,
    draw: () => `<circle cx="13" cy="13" r="12" fill="#f8fafc" stroke="#334155" stroke-width="2"/><path d="M13 13V6M13 13L18 15" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  trash: {
    label: 'Szemetes', cat: 'decor', w: 20, h: 20, layer: 1,
    draw: () => `<circle cx="10" cy="10" r="9" fill="#64748b" ${OL}/><circle cx="10" cy="10" r="6.5" fill="#334155"/>`,
  },
  label: {
    label: 'Felirat', cat: 'decor', w: 140, h: 30, layer: 2, tint: '#0f172a', resizable: true, hasLabel: true,
    draw: (w, h, c, text) => rr(0.5, 0.5, w - 1, h - 1, 6, c || '#0f172a', 'opacity=".75"')
      + `<text x="${w / 2}" y="${h / 2}" fill="#fff" font-size="${Math.max(9, Math.min(h * 0.55, 40))}" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif" text-anchor="middle" dominant-baseline="central">${escXml(text || 'Felirat')}</text>`,
  },

  wall: {
    label: 'Fal', cat: 'structure', w: 200, h: 14, layer: 1, tint: '#475569', resizable: true,
    draw: (w, h, c) => rr(0, 0, w, h, 2, shade(c || '#475569', -0.25)) + rr(0, 0, w, Math.max(3, h - 5), 2, c || '#475569') + rr(0, 0, w, 2, 1, '#fff', 'opacity=".12"'),
  },
  window: {
    label: 'Ablak', cat: 'structure', w: 120, h: 14, layer: 1, resizable: true,
    draw: (w, h) => rr(0, 0, w, h, 2, '#64748b') + rr(3, 3, w - 6, h - 6, 1, '#bae6fd') + `<path d="M${w / 2} 3V${h - 3}" stroke="#64748b" stroke-width="2"/>` + rr(6, 4, w * 0.25, 2, 1, '#fff', 'opacity=".7"'),
  },
  door: {
    label: 'Ajtó', cat: 'structure', w: 60, h: 14, layer: 1, resizable: true,
    draw: (w, h) => rr(0, 0, w, h, 2, '#92400e', OL) + rr(3, 3, w - 6, h - 6, 1, '#b45309') + `<circle cx="${w - 9}" cy="${h / 2}" r="2" fill="#fde047"/>`,
  },
  pillar: {
    label: 'Oszlop', cat: 'structure', w: 30, h: 30, layer: 1,
    draw: (w, h) => box(w, h, '#94a3b8', 5, 3),
  },
};

function escXml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function itemSVG(it) {
  const def = CATALOG[it.type];
  if (!def) return '';
  const w = it.w || def.w, h = it.h || def.h;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${def.draw(w, h, it.color || def.tint || '', it.label)}</svg>`;
}

// Ikon a szerkesztő palettájához
export function previewSVG(type) {
  const def = CATALOG[type];
  const w = def.w, h = def.h;
  return `<svg viewBox="-2 -2 ${w + 4} ${h + 4}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${def.draw(w, h, def.tint || '', 'Abc')}</svg>`;
}

/**
 * Mintairoda az alap (1600×1000) térképhez: szobák és berendezés.
 */
export function sampleOffice() {
  const zones = [
    { id: 0, name: 'Közös iroda', kind: 'talk', x: 60, y: 60, w: 760, h: 460, color: '#34d399', floor: 'wood' },
    { id: 0, name: 'Tárgyaló', kind: 'talk', x: 900, y: 60, w: 420, h: 300, color: '#60a5fa', floor: 'carpet' },
    { id: 0, name: 'Fókusz (csend)', kind: 'quiet', x: 900, y: 420, w: 420, h: 240, color: '#a78bfa', floor: 'carpet' },
    { id: 0, name: 'Konyha', kind: 'talk', x: 60, y: 600, w: 380, h: 330, color: '#fb923c', floor: 'tile' },
    { id: 0, name: 'Pihenő', kind: 'talk', x: 500, y: 600, w: 360, h: 330, color: '#f472b6', floor: 'carpet' },
  ];
  const items = [];
  const add = (type, x, y, extra = {}) => items.push({ type, x, y, w: CATALOG[type].w, h: CATALOG[type].h, rot: 0, color: '', label: '', ...extra });

  // Közös iroda: 2×3 asztal, monitorral, laptoppal, székkel
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 120 + col * 240, y = 150 + row * 190;
      add('desk', x, y);
      add('monitor', x + 16, y + 2);
      add('laptop', x + 74, y + 18);
      if ((row + col) % 2 === 0) add('mug', x + 104, y + 10, { color: ['#ef4444', '#3b82f6', '#22c55e'][col] });
      else add('cactus', x + 100, y + 4);
      add('office_chair', x + 43, y + 64);
    }
  }
  add('bookshelf', 90, 72, { w: 160 });
  add('bookshelf', 610, 72, { w: 180 });
  add('whiteboard', 330, 70, { w: 200 });
  add('big_plant', 760, 455);
  add('plant', 75, 470);
  add('cabinet', 765, 140);
  add('printer', 760, 300);
  add('label', 300, 470, { w: 220, h: 30, label: 'Közös iroda' });

  // Tárgyaló
  add('tv', 1055, 70);
  add('meeting_table', 1010, 170);
  for (let i = 0; i < 3; i++) {
    add('chair', 1035 + i * 60, 132, { color: '#334155' });
    add('chair', 1035 + i * 60, 266, { color: '#334155', rot: 180 });
  }
  add('chair', 968, 199, { color: '#334155', rot: 270 });
  add('chair', 1214, 199, { color: '#334155', rot: 90 });
  add('plant', 915, 75);
  add('plant', 1275, 75);
  add('laptop', 1030, 190);
  add('papers', 1150, 205);

  // Fókusz szoba
  for (let i = 0; i < 3; i++) {
    add('desk_white', 930 + i * 130, 470);
    add('laptop', 970 + i * 130, 484);
    add('office_chair', 968 + i * 130, 530);
  }
  add('armchair', 940, 590);
  add('floor_lamp', 1000, 605);
  add('big_plant', 1255, 595);

  // Konyha
  add('kitchen_counter', 80, 615, { w: 300 });
  add('coffee_machine', 300, 618);
  add('microwave', 250, 620);
  add('fridge', 384, 612);
  add('round_table', 140, 760);
  add('chair', 164, 722, { color: '#f97316' });
  add('chair', 164, 842, { color: '#f97316', rot: 180 });
  add('chair', 102, 784, { color: '#f97316', rot: 270 });
  add('chair', 226, 784, { color: '#f97316', rot: 90 });
  add('dining_table', 290, 760, { w: 110, h: 60 });
  add('water_cooler', 400, 880);
  add('flowers', 172, 775);
  add('trash', 80, 900);

  // Pihenő
  add('rug', 560, 680, { w: 240, h: 170, color: '#be185d' });
  add('sofa', 600, 620, { w: 160 });
  add('armchair', 530, 720, { rot: 90, color: '#0d9488' });
  add('armchair', 778, 720, { rot: 270, color: '#0d9488' });
  add('coffee_table', 645, 740, { w: 70 });
  add('beanbag', 600, 860, { color: '#f59e0b' });
  add('beanbag', 720, 860, { color: '#6366f1' });
  add('big_plant', 800, 620);
  add('floor_lamp', 520, 615);
  add('picture', 860, 830);

  // Nyitott tér: pingpong és növények
  add('pingpong', 1380, 760);
  add('plant', 1360, 690);
  add('plant', 1520, 690);
  add('big_plant', 1500, 100);
  add('label', 1380, 880, { w: 160, h: 28, label: 'Pingpong 🏓' });
  return { zones, items };
}
