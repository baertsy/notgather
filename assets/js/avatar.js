// Rajzolt (SVG) avatarok négy irányból, testreszabható részekkel.
// Minden rajz saját, kódból generált, külső kép nem kell hozzá.

export const AVATAR_OPTIONS = {
  skin: ['#f8d7b5', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'],
  hair: [
    ['short', 'Rövid'], ['bob', 'Bubi'], ['long', 'Hosszú'], ['ponytail', 'Lófarok'],
    ['bun', 'Konty'], ['curly', 'Göndör'], ['spiky', 'Tüskés'], ['bald', 'Kopasz'],
  ],
  hairColors: ['#1c1917', '#3b2416', '#6b4423', '#a0522d', '#d4a017', '#e8d5a3', '#9ca3af', '#c2410c', '#db2777', '#2563eb'],
  clothColors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f8fafc', '#64748b', '#334155', '#1e293b', '#78350f'],
  acc: [['none', 'Semmi'], ['glasses', 'Szemüveg'], ['sunglasses', 'Napszemüveg'], ['headphones', 'Fejhallgató'], ['cap', 'Sapka']],
};

export function defaultAvatar() {
  return { skin: '#f1c27d', hair: 'short', hairColor: '#3b2416', shirt: '#3b82f6', pants: '#334155', acc: 'none', accColor: '#ef4444' };
}

export function shade(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const OL = 'stroke="rgba(0,0,0,.35)" stroke-width=".8"';

// ---------------------------------------------------------------- haj

function hairFront(style, c) {
  const d = shade(c, -0.25);
  switch (style) {
    case 'short':
    case 'ponytail':
      return `<path d="M6.8 13C6.5 5.5 11 3.2 16 3.2S25.5 5.5 25.2 13C23.5 9.5 21 8.6 16 8.6S8.5 9.5 6.8 13Z" fill="${c}" ${OL}/>`;
    case 'bob':
      return `<path d="M6.4 19C5.4 6 10 3 16 3S26.6 6 25.6 19H22.8C23 12 21.5 9 16 9S9 12 9.2 19Z" fill="${c}" ${OL}/>`;
    case 'long':
      return `<path d="M6.2 27C4.6 6 10 2.8 16 2.8S27.4 6 25.8 27H22.6C23 12 21.5 9 16 9S9 12 9.4 27Z" fill="${c}" ${OL}/>`;
    case 'bun':
      return `<circle cx="16" cy="2.8" r="3.4" fill="${d}" ${OL}/><path d="M6.8 13C6.5 5.5 11 3.6 16 3.6S25.5 5.5 25.2 13C23.5 9.5 21 8.6 16 8.6S8.5 9.5 6.8 13Z" fill="${c}" ${OL}/>`;
    case 'curly':
      return [[8.3, 10.5, 3.6], [11, 6.3, 3.8], [16, 4.6, 4], [21, 6.3, 3.8], [23.7, 10.5, 3.6], [7.4, 14.5, 2.4], [24.6, 14.5, 2.4]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${OL}/>`).join('');
    case 'spiky':
      return `<path d="M7 13L6 6L10 8L11 2.5L14.5 6.5L16.5 1.5L18.5 6.5L22 2.5L22.5 8L26 6L25 13C23 9.5 20 8.6 16 8.6S9 9.5 7 13Z" fill="${c}" ${OL}/>`;
    default:
      return `<ellipse cx="13" cy="7.5" rx="2.4" ry="1.2" fill="#fff" opacity=".25"/>`;
  }
}

function hairBack(style, c) {
  const base = `<path d="M6.8 14C6.5 5 11 3 16 3S25.5 5 25.2 14C25 19 22 21.6 16 21.6S7 19 6.8 14Z" fill="${c}" ${OL}/>`;
  switch (style) {
    case 'bald': return '';
    case 'long': return `<path d="M6.3 27C5 6 10 3 16 3S27 6 25.7 27Z" fill="${c}" ${OL}/>`;
    case 'bob': return `<path d="M6.4 19.5C5.6 6 10 3 16 3S26.4 6 25.6 19.5Z" fill="${c}" ${OL}/>`;
    case 'ponytail': return base + `<path d="M14 20C13 25 14.5 29 16 30C17.5 29 19 25 18 20Z" fill="${shade(c, -0.15)}" ${OL}/>`;
    case 'bun': return base + `<circle cx="16" cy="4" r="3.6" fill="${shade(c, -0.2)}" ${OL}/>`;
    case 'curly': return [[8.5, 10, 4], [12, 6, 4], [16, 4.8, 4.2], [20, 6, 4], [23.5, 10, 4], [8.5, 15.5, 3.4], [23.5, 15.5, 3.4], [12, 18, 3.6], [16, 19, 3.6], [20, 18, 3.6], [16, 12, 6]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
    case 'spiky': return base + `<path d="M8 8L9 1.8L12.5 5.5L16 0.8L19.5 5.5L23 1.8L24 8Z" fill="${c}" ${OL}/>`;
    default: return base;
  }
}

// balra néző profil
function hairSide(style, c) {
  const base = `<path d="M7 12C7 5 11 3 16.5 3S25.6 6.5 25.2 13C25 17 24 19.5 22 21L20.6 13C19 9.6 14 8.6 7 12Z" fill="${c}" ${OL}/>`;
  switch (style) {
    case 'bald': return `<ellipse cx="14" cy="7" rx="2.4" ry="1.2" fill="#fff" opacity=".25"/>`;
    case 'long': return base + `<path d="M19.5 12L25.6 12L25.8 27L21 27Z" fill="${c}" ${OL}/>`;
    case 'bob': return base + `<path d="M19.5 12L25.6 12L25.4 19.5L21 19.5Z" fill="${c}" ${OL}/>`;
    case 'ponytail': return base + `<path d="M23 12C28 12 29.5 18 27.5 24C26 22 25 18 23.5 16Z" fill="${shade(c, -0.15)}" ${OL}/>`;
    case 'bun': return `<circle cx="22.5" cy="5" r="3.4" fill="${shade(c, -0.2)}" ${OL}/>` + base;
    case 'curly': return [[10, 7, 3.6], [14, 4.6, 3.8], [19, 4.6, 4], [23, 7.5, 3.8], [24.5, 12, 3.4], [23.5, 16.5, 3], [21, 19.5, 2.6]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${OL}/>`).join('');
    case 'spiky': return `<path d="M7 12L7.5 5L11 6.5L12.5 1.5L16 5L19 1L21 5.5L25 3L25.4 13C25 17 24 19.5 22 21L20.6 13C19 9.6 14 8.6 7 12Z" fill="${c}" ${OL}/>`;
    default: return base;
  }
}

// ---------------------------------------------------------------- kiegészítők

function accFront(a, c) {
  switch (a) {
    case 'glasses':
      return `<g fill="rgba(255,255,255,.18)" stroke="#111827" stroke-width=".9"><circle cx="12.3" cy="14" r="2.6"/><circle cx="19.7" cy="14" r="2.6"/></g><path d="M14.9 14H17.1" stroke="#111827" stroke-width=".9"/>`;
    case 'sunglasses':
      return `<g fill="#0f172a"><rect x="9.4" y="12.3" width="5.6" height="3.6" rx="1.4"/><rect x="17" y="12.3" width="5.6" height="3.6" rx="1.4"/></g><path d="M15 13.4H17" stroke="#0f172a" stroke-width="1"/>`;
    case 'headphones':
      return `<path d="M6.6 14C6.6 1.8 25.4 1.8 25.4 14" fill="none" stroke="${shade(c, -0.2)}" stroke-width="2"/><rect x="4.6" y="11.5" width="3.6" height="6.5" rx="1.6" fill="${c}" ${OL}/><rect x="23.8" y="11.5" width="3.6" height="6.5" rx="1.6" fill="${c}" ${OL}/>`;
    case 'cap':
      return `<path d="M6.8 10.5C7 3.5 11 2.4 16 2.4S25 3.5 25.2 10.5Z" fill="${c}" ${OL}/><ellipse cx="16" cy="10.6" rx="9.8" ry="2" fill="${shade(c, -0.25)}"/>`;
    default: return '';
  }
}

function accBack(a, c) {
  switch (a) {
    case 'headphones':
      return `<path d="M6.6 14C6.6 1.8 25.4 1.8 25.4 14" fill="none" stroke="${shade(c, -0.2)}" stroke-width="2"/><rect x="4.6" y="11.5" width="3.6" height="6.5" rx="1.6" fill="${c}" ${OL}/><rect x="23.8" y="11.5" width="3.6" height="6.5" rx="1.6" fill="${c}" ${OL}/>`;
    case 'cap':
      return `<path d="M6.6 12C6.8 3.5 11 2.4 16 2.4S25.2 3.5 25.4 12Z" fill="${c}" ${OL}/>`;
    default: return '';
  }
}

function accSide(a, c) {
  switch (a) {
    case 'glasses':
      return `<circle cx="11" cy="13.6" r="2.5" fill="rgba(255,255,255,.18)" stroke="#111827" stroke-width=".9"/><path d="M13.5 13.4H19" stroke="#111827" stroke-width=".9"/>`;
    case 'sunglasses':
      return `<rect x="8" y="12" width="5.4" height="3.4" rx="1.3" fill="#0f172a"/><path d="M13.4 13H19" stroke="#0f172a" stroke-width="1"/>`;
    case 'headphones':
      return `<path d="M10 6C14 1.5 22 2.5 21 10" fill="none" stroke="${shade(c, -0.2)}" stroke-width="2"/><rect x="17.6" y="10" width="4.4" height="7" rx="2" fill="${c}" ${OL}/>`;
    case 'cap':
      return `<path d="M7 10.5C7.4 3.5 11.5 2.4 16.5 2.4S25.4 4 25.4 11Z" fill="${c}" ${OL}/><path d="M1.8 11.3L12 10.2L12 12L2.4 12.6Z" fill="${shade(c, -0.25)}"/>`;
    default: return '';
  }
}

// ---------------------------------------------------------------- test

function legs(cfg, side, pose, dir) {
  const p = cfg.pants, s = '#1f2937';
  if (pose === 'sit') {
    // ülve: a comb előre néz, csak a térd és a cipő látszik
    if (dir === 'up') return '';
    if (side) return `<rect x="7" y="30" width="11" height="4.6" rx="2" fill="${p}" ${OL}/><rect x="6.5" y="30" width="4.6" height="8" rx="1.8" fill="${p}" ${OL}/><rect x="4.6" y="36.4" width="6" height="3" rx="1.4" fill="${s}"/>`;
    return `<rect x="10.6" y="30" width="4.4" height="6" rx="1.6" fill="${p}" ${OL}/><rect x="17" y="30" width="4.4" height="6" rx="1.6" fill="${p}" ${OL}/>`
      + `<rect x="10.2" y="35" width="5.2" height="3" rx="1.4" fill="${s}"/><rect x="16.6" y="35" width="5.2" height="3" rx="1.4" fill="${s}"/>`;
  }
  if (side) {
    return `<g class="lg-a"><rect x="15.5" y="31" width="4.2" height="8.5" rx="1.6" fill="${shade(p, -0.2)}"/><rect x="13.6" y="38.4" width="6" height="3" rx="1.4" fill="${s}"/></g>`
      + `<g class="lg-b"><rect x="12.4" y="31" width="4.2" height="8.5" rx="1.6" fill="${p}" ${OL}/><rect x="10.4" y="38.4" width="6" height="3" rx="1.4" fill="${s}"/></g>`;
  }
  return `<g class="lg-a"><rect x="10.6" y="31" width="4.4" height="8.5" rx="1.6" fill="${p}" ${OL}/><rect x="10.2" y="38.4" width="5.2" height="3" rx="1.4" fill="${s}"/></g>`
    + `<g class="lg-b"><rect x="17" y="31" width="4.4" height="8.5" rx="1.6" fill="${p}" ${OL}/><rect x="16.6" y="38.4" width="5.2" height="3" rx="1.4" fill="${s}"/></g>`;
}

function torso(cfg, side) {
  const sh = cfg.shirt, sk = cfg.skin, dk = shade(sh, -0.18);
  if (side) {
    return `<rect x="10" y="20.5" width="12" height="12.5" rx="5" fill="${sh}" ${OL}/>`
      + `<g class="arm"><rect x="13.4" y="21.5" width="5" height="10" rx="2.5" fill="${dk}" ${OL}/><circle cx="15.9" cy="31.6" r="1.9" fill="${sk}" ${OL}/></g>`;
  }
  return `<rect x="4.8" y="21.5" width="4.2" height="10" rx="2.1" fill="${dk}" ${OL}/><rect x="23" y="21.5" width="4.2" height="10" rx="2.1" fill="${dk}" ${OL}/>`
    + `<circle cx="6.9" cy="31.8" r="1.9" fill="${sk}" ${OL}/><circle cx="25.1" cy="31.8" r="1.9" fill="${sk}" ${OL}/>`
    + `<rect x="8" y="20.5" width="16" height="12.5" rx="5" fill="${sh}" ${OL}/>`;
}

/**
 * Az avatar SVG kódja.
 * @param {object} cfg avatar beállítások
 * @param {'down'|'up'|'left'|'right'} dir merre néz
 * @param {{head?: boolean}} [o] csak a fej (pl. a chatlistába)
 */
export function avatarSVG(cfg, dir = 'down', o = {}) {
  cfg = { ...defaultAvatar(), ...(cfg || {}) };
  const side = dir === 'left' || dir === 'right';
  const sk = cfg.skin;
  let inner = '';
  if (!o.head) inner += `<ellipse class="av-shadow" cx="16" cy="41" rx="9" ry="2.4" fill="rgba(0,0,0,.35)"/>`;
  let fig = '';
  if (!o.head) fig += legs(cfg, side, o.pose, dir) + torso(cfg, side);
  if (dir === 'down') {
    if (cfg.hair === 'long' || cfg.hair === 'bob') fig += `<path d="${cfg.hair === 'long' ? 'M7 26V12H25V26Z' : 'M7 19V12H25V19Z'}" fill="${shade(cfg.hairColor, -0.2)}"/>`;
    fig += `<circle cx="7.2" cy="14.5" r="1.7" fill="${sk}" ${OL}/><circle cx="24.8" cy="14.5" r="1.7" fill="${sk}" ${OL}/>`
      + `<circle cx="16" cy="13" r="9" fill="${sk}" ${OL}/>`
      + `<circle cx="10.6" cy="16.6" r="1.5" fill="#f87171" opacity=".22"/><circle cx="21.4" cy="16.6" r="1.5" fill="#f87171" opacity=".22"/>`
      + `<ellipse cx="12.3" cy="14" rx="1.1" ry="1.4" fill="#1f2937"/><ellipse cx="19.7" cy="14" rx="1.1" ry="1.4" fill="#1f2937"/>`
      + `<path d="M14.3 17.6Q16 18.9 17.7 17.6" stroke="#7c2d12" stroke-width=".9" fill="none" stroke-linecap="round"/>`
      + hairFront(cfg.hair, cfg.hairColor) + accFront(cfg.acc, cfg.accColor);
  } else if (dir === 'up') {
    fig += `<circle cx="7.2" cy="14.5" r="1.7" fill="${sk}" ${OL}/><circle cx="24.8" cy="14.5" r="1.7" fill="${sk}" ${OL}/>`
      + `<circle cx="16" cy="13" r="9" fill="${sk}" ${OL}/>` + hairBack(cfg.hair, cfg.hairColor) + accBack(cfg.acc, cfg.accColor);
  } else {
    let g = `<circle cx="16" cy="13" r="9" fill="${sk}" ${OL}/><circle cx="19.5" cy="14.2" r="1.7" fill="${sk}" ${OL}/>`
      + `<ellipse cx="11" cy="13.8" rx="1.05" ry="1.35" fill="#1f2937"/><circle cx="10.4" cy="16.8" r="1.4" fill="#f87171" opacity=".22"/>`
      + `<path d="M8.6 18Q9.8 18.8 10.8 18.2" stroke="#7c2d12" stroke-width=".9" fill="none" stroke-linecap="round"/>`
      + hairSide(cfg.hair, cfg.hairColor) + accSide(cfg.acc, cfg.accColor);
    fig += g;
  }
  if (side && dir === 'right') fig = `<g transform="translate(32 0) scale(-1 1)">${fig}</g>`;
  inner += `<g class="av-body">${fig}</g>`;
  const vb = o.head ? '4 1 24 24' : '0 0 32 44';
  return `<svg class="av-svg" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}
