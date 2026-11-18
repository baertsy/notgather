// Nagy, animált jelenetek a modális ablakokba (ablakon kinézés, kandalló,
// akvárium, növény, légzőgyakorlat). Csak SVG + CSS, külső kép nélkül.

import { plantStatus } from './furniture.js';

// ---------------------------------------------------------------- tájkép az ablakból

function skyFor(hour) {
  if (hour >= 21 || hour < 5) return { top: '#0b1026', bottom: '#1e2a5a', sun: null, moon: true, stars: true, hill1: '#14213d', hill2: '#1b2a4a', hill3: '#22345a', water: '#1e3a5f', name: 'éjszaka' };
  if (hour < 7) return { top: '#3b4a8a', bottom: '#f6a87a', sun: { y: 70, c: '#fdba74' }, hill1: '#3b5249', hill2: '#4f6b5c', hill3: '#5d7f6b', water: '#a3b9d9', name: 'hajnal' };
  if (hour < 17) return { top: '#4aa3df', bottom: '#cdeefd', sun: { y: 22, c: '#fde68a' }, hill1: '#2f7d4f', hill2: '#3f9a5f', hill3: '#57b36f', water: '#5fb3e0', name: 'nappal' };
  if (hour < 19) return { top: '#f59e6b', bottom: '#fde3b0', sun: { y: 60, c: '#fb923c' }, hill1: '#5b6b3a', hill2: '#788a45', hill3: '#8fa152', water: '#f2b48b', name: 'naplemente' };
  return { top: '#3a3f8f', bottom: '#d87a7a', sun: { y: 82, c: '#f97316' }, hill1: '#2d3a4a', hill2: '#3c4b5c', hill3: '#4b5d6e', water: '#7a7fb5', name: 'alkonyat' };
}

export function windowScene(seed = 1) {
  const hour = new Date().getHours();
  const s = skyFor(hour);
  const rnd = mulberry(seed * 9301 + 49297);
  const stars = s.stars ? Array.from({ length: 70 }, () => `<circle class="star" cx="${rnd() * 400}" cy="${rnd() * 120}" r="${rnd() * 0.9 + 0.3}" fill="#fff" style="animation-delay:${rnd() * 4}s"/>`).join('') : '';
  const clouds = Array.from({ length: 5 }, (_, i) => {
    const y = 15 + rnd() * 50, sc = 0.6 + rnd() * 0.8, dur = 60 + rnd() * 80;
    return `<g class="cloud" style="animation-duration:${dur}s;animation-delay:-${rnd() * dur}s" opacity="${s.stars ? 0.25 : 0.85}"><g transform="translate(0 ${y}) scale(${sc})"><ellipse cx="20" cy="10" rx="20" ry="8" fill="#fff"/><ellipse cx="35" cy="6" rx="14" ry="9" fill="#fff"/><ellipse cx="48" cy="11" rx="15" ry="7" fill="#fff"/></g></g>`;
  }).join('');
  const birds = s.stars ? '' : Array.from({ length: 4 }, () => {
    const y = 30 + rnd() * 50, dur = 18 + rnd() * 20;
    return `<g class="bird" style="animation-duration:${dur}s;animation-delay:-${rnd() * dur}s"><path class="wing" d="M0 ${y}q4 -4 8 0q4 -4 8 0" stroke="#1f2937" stroke-width="1.2" fill="none"/></g>`;
  }).join('');
  const trees = Array.from({ length: 14 }, (_, i) => {
    const x = i * 30 + rnd() * 20, h = 18 + rnd() * 16, y = 178 - rnd() * 8;
    return `<g class="tree" style="transform-origin:${x}px ${y}px;animation-delay:-${rnd() * 5}s"><rect x="${x - 1.5}" y="${y - 6}" width="3" height="8" fill="#3f2a1d"/><path d="M${x} ${y - h - 6}L${x - 9} ${y - 4}H${x + 9}Z" fill="${s.hill1}"/><path d="M${x} ${y - h - 12}L${x - 7} ${y - h + 6}H${x + 7}Z" fill="${s.hill2}"/></g>`;
  }).join('');
  const flies = s.stars ? Array.from({ length: 14 }, () => `<circle class="firefly" cx="${rnd() * 400}" cy="${150 + rnd() * 40}" r="1.3" fill="#fde047" style="animation-delay:${rnd() * 6}s;animation-duration:${4 + rnd() * 4}s"/>`).join('') : '';
  return `<svg class="scene-svg window-scene" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.top}"/><stop offset="1" stop-color="${s.bottom}"/></linearGradient>
    <linearGradient id="wat${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.water}"/><stop offset="1" stop-color="${s.hill1}"/></linearGradient></defs>
    <rect width="400" height="225" fill="url(#sky${seed})"/>
    ${stars}
    ${s.moon ? '<circle cx="320" cy="38" r="14" fill="#f8fafc"/><circle cx="326" cy="34" r="12" fill="' + s.top + '"/>' : ''}
    ${s.sun ? `<circle class="sun" cx="300" cy="${s.sun.y}" r="16" fill="${s.sun.c}"/>` : ''}
    ${clouds}
    <path d="M0 120L40 92L80 110L130 70L175 105L220 80L270 112L320 78L360 98L400 86V225H0Z" fill="${s.hill3}" opacity=".9"/>
    <path d="M0 140L60 118L120 135L190 110L250 132L310 115L400 130V225H0Z" fill="${s.hill2}"/>
    <rect y="150" width="400" height="30" fill="url(#wat${seed})" opacity=".9"/>
    <g class="shimmer"><path d="M30 160h30M120 166h40M220 158h26M300 168h44M70 173h20M260 175h30" stroke="#fff" stroke-width="1" opacity=".5"/></g>
    ${trees}
    <path d="M0 178Q100 170 200 180T400 176V225H0Z" fill="${s.hill1}"/>
    ${birds}${flies}
    <g class="rain-layer">${Array.from({ length: 60 }, () => { const x = rnd() * 400, y = rnd() * 225; return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 3).toFixed(1)}" y2="${(y + 9).toFixed(1)}" class="drop" style="animation-delay:-${rnd().toFixed(2)}s"/>`; }).join('')}</g>
  </svg><div class="scene-caption">${captionFor(s.name)}</div>`;
}

function captionFor(name) {
  return { 'éjszaka': 'Csillagos éjszaka. Szentjánosbogarak a tó partján.', hajnal: 'Hajnalodik. Ébrednek a madarak.', nappal: 'Napsütés, madárcsicsergés, lágy szellő.', naplemente: 'Naplemente a dombok fölött.', alkonyat: 'Alkonyat. Csendesedik a táj.' }[name] || '';
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- kandalló

export function fireScene() {
  const flames = Array.from({ length: 7 }, (_, i) => {
    const x = 140 + i * 20 + (i % 2) * 6, h = 50 + (i % 3) * 18;
    return `<path class="fl fl${i % 3}" style="transform-origin:${x}px 175px;animation-delay:-${i * 0.23}s" d="M${x - 14} 175C${x - 18} ${175 - h * 0.5} ${x - 4} ${175 - h * 0.7} ${x} ${175 - h}C${x + 6} ${175 - h * 0.6} ${x + 18} ${175 - h * 0.5} ${x + 14} 175Z" fill="${['#f97316', '#fb923c', '#facc15'][i % 3]}" opacity=".9"/>`;
  }).join('');
  const sparks = Array.from({ length: 12 }, (_, i) => `<circle class="spark" cx="${160 + (i * 37) % 90}" cy="150" r="1.2" fill="#fde047" style="animation-delay:-${(i * 0.37) % 3}s"/>`).join('');
  return `<svg class="scene-svg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="glow" cx=".5" cy=".75" r=".6"><stop offset="0" stop-color="#f97316" stop-opacity=".55"/><stop offset="1" stop-color="#1c1917" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="225" fill="#1c1917"/>
    <rect width="400" height="225" fill="url(#glow)" class="glow"/>
    <path d="M80 225V40H320V225H280V90Q200 60 120 90V225Z" fill="#78716c"/>
    <rect x="60" y="30" width="280" height="16" rx="3" fill="#a8a29e"/>
    <path d="M120 225V90Q200 60 280 90V225Z" fill="#0c0a09"/>
    ${flames}${sparks}
    <rect x="135" y="172" width="130" height="10" rx="5" fill="#78350f"/><rect x="150" y="166" width="100" height="9" rx="4.5" fill="#92400e" transform="rotate(-4 200 170)"/>
    <rect x="90" y="16" width="26" height="16" rx="2" fill="#16a34a"/><rect x="270" y="12" width="20" height="20" rx="3" fill="#b45309"/>
  </svg><div class="scene-caption">Ropog a tűz. Dőlj hátra egy kicsit.</div>`;
}

// ---------------------------------------------------------------- akvárium

export function aquariumScene(hungry) {
  const fish = [['#f97316', 30, 9], ['#facc15', 70, 13], ['#38bdf8', 110, 11], ['#f472b6', 150, 15], ['#a3e635', 90, 8], ['#fb7185', 130, 12]].map(([c, y, d], i) =>
    `<g class="afish" style="animation-duration:${d}s;animation-delay:-${i * 1.7}s"><g transform="translate(0 ${y})"><path d="M14 0l9-6v12z" fill="${c}"/><ellipse cx="6" cy="0" rx="11" ry="6.5" fill="${c}"/><circle cx="0" cy="-1.5" r="1.4" fill="#0f172a"/></g></g>`).join('');
  const bubbles = Array.from({ length: 14 }, (_, i) => `<circle class="bubble" cx="${40 + (i * 53) % 320}" cy="210" r="${2 + (i % 3)}" fill="none" stroke="#e0f2fe" stroke-width="1" style="animation-delay:-${(i * 0.6) % 6}s"/>`).join('');
  return `<svg class="scene-svg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="aq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0c4a6e"/></linearGradient></defs>
    <rect width="400" height="225" fill="url(#aq)"/>
    <g class="rays" opacity=".18"><path d="M60 0L20 225H60L110 0ZM200 0L170 225H210L240 0ZM320 0L300 225H330L350 0Z" fill="#fff"/></g>
    ${fish}${bubbles}
    <path d="M0 200Q60 188 120 198T240 195T400 196V225H0Z" fill="#d6b98c"/>
    ${[40, 95, 300, 350].map((x, i) => `<path class="weed" style="transform-origin:${x}px 200px;animation-delay:-${i}s" d="M${x} 200C${x - 10} 170 ${x + 10} 150 ${x} 110" stroke="#16a34a" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
    <circle cx="230" cy="196" r="8" fill="#94a3b8"/><circle cx="244" cy="199" r="5" fill="#64748b"/>
  </svg><div class="scene-caption">${hungry ? 'A halak éhesek, a felszín felé úszkálnak.' : 'A halak elégedetten úszkálnak.'}</div>`;
}

// ---------------------------------------------------------------- növény állapota

export const PLANT_TEXT = {
  good: { title: 'Egészséges, jól van 🌿', text: 'A föld kellemesen nedves. Most nem kell locsolni.' },
  thirsty: { title: 'Szomjas 😕', text: 'A föld kezd kiszáradni, a levelek lankadnak. Jól esne neki egy kis víz.' },
  dying: { title: 'Haldoklik! 🥀', text: 'Teljesen kiszáradt, a levelek barnulnak. Sürgősen locsold meg!' },
  over: { title: 'Túl van locsolva 💦', text: 'Áll a víz a cserépben, a levelek sárgulnak. Pár napig ne locsold!' },
};

export function plantScene(st, type = 'plant') {
  const { status, m } = plantStatus(st);
  const leaf = { good: '#22c55e', thirsty: '#9bbf3a', dying: '#a16207', over: '#b5c31a' }[status];
  const droop = { good: 0, thirsty: 10, dying: 26, over: 16 }[status];
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const a = -150 + i * 15 + (i % 2 ? 4 : -4);
    const rad = (a * Math.PI) / 180;
    const len = 55 + (i % 3) * 14;
    const x2 = 200 + Math.cos(rad) * len, y2 = 120 + Math.sin(rad) * len + droop * (1 - Math.abs(Math.cos(rad)) * 0.3) * (status === 'good' ? 0 : 1.6);
    return `<path d="M200 140Q${(200 + x2) / 2} ${(140 + y2) / 2 - 18} ${x2} ${y2}" stroke="${leaf}" stroke-width="3" fill="none"/><ellipse cx="${x2}" cy="${y2}" rx="16" ry="8" transform="rotate(${a + (status === 'good' ? 0 : 35)} ${x2} ${y2})" fill="${leaf}" stroke="rgba(0,0,0,.25)"/>`;
  }).join('');
  const flowers = (type === 'flowers' || type === 'flower_bed') && status !== 'dying'
    ? [[160, 70], [240, 66], [200, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y + droop}" r="11" fill="#ec4899"/><circle cx="${x}" cy="${y + droop}" r="4" fill="#fde047"/>`).join('') : '';
  const dead = status === 'dying' ? `<path d="M150 190l6 -6M250 192l-5 -7" stroke="#78350f" stroke-width="3"/><ellipse cx="236" cy="198" rx="9" ry="3.5" fill="#a16207" transform="rotate(20 236 198)"/>` : '';
  const puddle = status === 'over' ? `<ellipse cx="200" cy="210" rx="90" ry="9" fill="#38bdf8" opacity=".6"/><circle class="dripdrop" cx="160" cy="170" r="3" fill="#38bdf8"/>` : '';
  const soil = { good: '#5b3a1e', thirsty: '#8a6a45', dying: '#b8996b', over: '#3b2412' }[status];
  const cracks = status === 'dying' || status === 'thirsty' ? '<path d="M175 147l8 3l6 -3M212 146l7 4l7 -2" stroke="#6b4f2c" stroke-width="1.5" fill="none"/>' : '';
  return `<svg class="scene-svg plant-svg" viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="#f1f5f9"/><rect y="195" width="400" height="30" fill="#e2e8f0"/>
    ${puddle}${leaves}${flowers}
    <path d="M150 145H250L238 205H162Z" fill="#c2410c" stroke="rgba(0,0,0,.3)"/><rect x="146" y="138" width="108" height="12" rx="3" fill="#ea580c"/>
    <ellipse cx="200" cy="142" rx="50" ry="5" fill="${soil}"/>${cracks}${dead}
  </svg>`
    + `<div class="meter big"><div class="meter-fill" style="width:${Math.min(100, m / 1.5)}%;background:${status === 'good' ? '#22c55e' : status === 'over' ? '#38bdf8' : status === 'thirsty' ? '#eab308' : '#ef4444'}"></div></div>`;
}

// ---------------------------------------------------------------- légzőgyakorlat

export function breathScene() {
  return `<div class="breath"><div class="breath-circle"></div><div class="breath-text">Belégzés…</div></div>`;
}
