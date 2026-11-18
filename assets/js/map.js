// A 2D iroda: szobák, tárgyak, avatarok, mozgás ütközéssel, útkeresés,
// tárgyak közelsége és a szerkesztő logikája.

import { S, zoneAt } from './store.js';
import { el, ICONS, api, toast } from './util.js';
import { avatarSVG } from './avatar.js';
import { CATALOG, itemSVG, itemBox, seatsOf, newUid } from './furniture.js';
import * as nav from './nav.js';

const SPEED = 200;          // px / mp
const FIG_W = 36, FEET = 46;
const NEAR = 30;            // ennyin belül "közel" van egy tárgy

let root, viewport, world, zonesLayer, floorLayer, sceneLayer, labelsLayer, hintEl, popover = null;
let scale = 1;
let hooks = {};
const avatarEls = new Map(); // userId -> element
const itemEls = new Map();   // uid -> element
const held = [];
let path = null;            // hátralévő töréspontok
let onArrive = null;
let stuckSince = 0;
let rafId = 0;
let lastT = 0;
let editing = null;         // { zones, items, world, tab, sel }
let doorAccess = () => 'closed';
let nearItem = null;
let lastBump = 0;

const KEY_DIR = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export function initMap(container, h) {
  hooks = h;
  root = container;
  root.innerHTML = '';
  viewport = el('div', { class: 'viewport' });
  world = el('div', { class: 'world' });
  zonesLayer = el('div', { class: 'zones' });
  floorLayer = el('div', { class: 'floor-items' });
  sceneLayer = el('div', { class: 'scene-layer' });
  labelsLayer = el('div', { class: 'labels' });
  world.append(zonesLayer, floorLayer, sceneLayer, labelsLayer);
  viewport.append(world);
  hintEl = el('div', { class: 'near-hint hidden' });
  root.append(viewport, hintEl);

  new ResizeObserver(fit).observe(viewport);
  world.addEventListener('mousedown', onWorldMouseDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => {
    const d = KEY_DIR[(e.key || '').toLowerCase()];
    const i = d ? held.indexOf(d) : -1;
    if (i >= 0) held.splice(i, 1);
  });
  window.addEventListener('blur', () => { held.length = 0; });
  // az órák mutatói percenként frissülnek
  setInterval(() => { for (const it of S.items) if (CATALOG[it.type]?.ticking) updateItem(it.uid); }, 30000);
  renderZones();
  renderItems();
  fit();
}

function curWorld() { return editing ? editing.world : S.world; }

function fit() {
  if (!viewport) return;
  const { w: W, h: H } = curWorld();
  const r = viewport.getBoundingClientRect();
  scale = Math.min(r.width / W, r.height / H, 1.5);
  world.style.width = W + 'px';
  world.style.height = H + 'px';
  const ox = (r.width - W * scale) / 2;
  const oy = (r.height - H * scale) / 2;
  world.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
}

function toWorld(e) {
  const r = world.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

// ---------------------------------------------------------------- akadályok

export function setDoorAccess(fn) { doorAccess = fn; }

export function rebuildNav() {
  nav.build(S.items, S.world, doorAccess);
}

// ---------------------------------------------------------------- szobák

export function renderZones() {
  if (!zonesLayer) return;
  const zones = editing ? editing.zones : S.zones;
  const editZones = editing && editing.tab === 'zones';
  zonesLayer.innerHTML = '';
  labelsLayer.innerHTML = '';
  const party = partyZones();
  for (const z of zones) {
    const sel = editing?.sel?.obj === z;
    const node = el('div', {
      class: `zone floor-${z.floor || 'none'} ${z.kind === 'quiet' ? 'quiet' : ''} ${!editing && S.local.zone === z.id ? 'here' : ''} ${sel ? 'selected' : ''} ${party.has(z.id) ? 'party' : ''}`,
      style: { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px', '--zc': z.color },
    });
    labelsLayer.append(el('div', { class: 'zone-label', style: { left: z.x + 8 + 'px', top: z.y + 6 + 'px' } }, (z.kind === 'quiet' ? '🤫 ' : '') + z.name));
    if (editZones) {
      node.addEventListener('mousedown', (e) => startDrag(e, 'zone', z, 'move'));
      const handle = el('div', { class: 'handle' });
      handle.addEventListener('mousedown', (e) => startDrag(e, 'zone', z, 'resize'));
      node.append(handle);
    }
    zonesLayer.append(node);
  }
  root?.classList.toggle('edit-zones', !!editZones);
  fit();
}

// Azok a szobák, ahol be van kapcsolva a diszkógömb
function partyZones() {
  const out = new Set();
  if (editing) return out;
  for (const it of S.items) {
    if (it.type !== 'disco_ball' || !S.itemStates[it.uid]?.on) continue;
    const z = zoneAt(it.x + it.w / 2, it.y + it.h / 2);
    if (z) out.add(z.id);
  }
  return out;
}

// ---------------------------------------------------------------- tárgyak

// Mélység: a tárgy alsó éle; az asztalon lévő tárgy az alatta lévő bútor fölé kerül.
function depthOf(it, all) {
  const def = CATALOG[it.type];
  const b = itemBox(it);
  if (def.layer === 3) return 2;
  let z = b.y + b.h;
  if (def.layer === 2) {
    for (const o of all) {
      if (o === it || CATALOG[o.type]?.layer !== 1) continue;
      const ob = itemBox(o);
      if (b.x < ob.x + ob.w && b.x + b.w > ob.x && b.y < ob.y + ob.h && b.y + b.h > ob.y) z = Math.max(z, ob.y + ob.h + 0.5);
    }
  }
  return z;
}

const zIndexOf = (z) => String(100 + Math.round(z * 2));

function interactive(it) {
  const def = CATALOG[it.type];
  return !!(def?.actions?.length || it.url);
}

export function renderItems() {
  if (!sceneLayer) return;
  const items = editing ? editing.items : S.items;
  const editItems = editing && editing.tab === 'items';
  for (const n of itemEls.values()) n.remove();
  itemEls.clear();
  floorLayer.innerHTML = '';
  const party = partyZones();
  items.forEach((it, idx) => {
    const def = CATALOG[it.type];
    if (!def) return;
    const sel = editing?.sel?.obj === it;
    const node = el('div', {
      class: `item it-${it.type} ${sel ? 'selected' : ''} ${!editing && interactive(it) ? 'interactive' : ''} ${it.type === 'dance_floor' && party.has(zoneAt(it.x + it.w / 2, it.y + it.h / 2)?.id) ? 'party' : ''}`,
      'data-uid': it.uid || '',
      style: { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px', transform: it.rot ? `rotate(${it.rot}deg)` : '' },
      html: itemSVG(it, editing ? {} : S.itemStates[it.uid]),
    });
    node.style.zIndex = def.layer === 0 ? String(idx) : zIndexOf(depthOf(it, items) + idx * 0.0001);
    if (editItems) {
      node.addEventListener('mousedown', (e) => startDrag(e, 'item', it, 'move'));
      if (def.resizable) {
        const handle = el('div', { class: 'handle' });
        handle.addEventListener('mousedown', (e) => startDrag(e, 'item', it, 'resize'));
        node.append(handle);
      }
    } else if (!editing && interactive(it)) {
      node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        closePopover();
        hooks.onItemClick?.(it);
      });
    }
    (def.layer === 0 ? floorLayer : sceneLayer).append(node);
    if (it.uid) itemEls.set(it.uid, node);
  });
  root?.classList.toggle('edit-items', !!editItems);
  if (!editing) { rebuildNav(); renderZones(); }
}

/** Egy tárgy újrarajzolása (állapotváltozás után). */
export function updateItem(uid) {
  const node = itemEls.get(uid);
  const it = S.items.find((i) => i.uid === uid);
  if (!node || !it || editing) return;
  const keep = node.querySelector('.handle');
  node.innerHTML = itemSVG(it, S.itemStates[uid]);
  if (keep) node.append(keep);
  if (CATALOG[it.type]?.door) rebuildNav();
  if (it.type === 'disco_ball') renderItems();
}

export function itemNode(uid) { return itemEls.get(uid); }

// ---------------------------------------------------------------- avatarok

function avatarNode(u, isMe) {
  const node = el('div', { class: `avatar ${isMe ? 'me' : 'remote'}`, 'data-id': u.id },
    el('div', { class: 'av-ring' }),
    el('div', { class: 'av-fig' }),
    el('div', { class: 'av-name' }, el('span', { class: 'av-dot' }), el('span', { class: 'av-text' })),
    el('span', { class: 'av-hold' }),
    el('span', { class: 'av-act' }),
    el('span', { class: 'av-mic', html: ICONS.micOff }),
    el('span', { class: 'av-warn', title: 'Nincs hangkapcsolat vele', html: ICONS.warn }),
    el('span', { class: 'av-call', html: ICONS.phone }));
  if (!isMe) node.addEventListener('mousedown', (e) => { e.stopPropagation(); if (!editing) openPopover(u.id); });
  sceneLayer.append(node);
  return node;
}

const ACT_ICON = { type: '⌨️', brew: '☕', drink: '😋', read: '📖', run: '🏃', yoga: '🧘', play: '🎮', music: '🎵', water: '💧', wash: '🫧', chill: '🌿', pong: '🏓', print: '🖨️', cook: '🍳', pet: '💕', phone: '📞', draw: '✏️', dance: '💃' };

function seatDepth(u) {
  if (!u.pose || !u.seat) return null;
  const it = S.items.find((i) => i.uid === u.seat);
  if (!it) return null;
  const b = itemBox(it);
  return b.y + b.h + 1;
}

function paintAvatar(node, u, isMe) {
  const lying = u.pose === 'lie';
  node.style.transform = `translate(${u.x - FIG_W / 2}px, ${u.y - FEET}px)`;
  const z = seatDepth(u) ?? u.y;
  node.style.zIndex = zIndexOf(z + 0.3);
  const dir = lying ? 'down' : u.dir || 'down';
  const key = JSON.stringify(u.avatar || null) + dir + (u.pose || '');
  if (node._key !== key) {
    node._key = key;
    node.children[1].innerHTML = avatarSVG(u.avatar, dir, { pose: u.pose === 'sit' ? 'sit' : null });
  }
  const text = node.querySelector('.av-text');
  const name = u.name + (isMe ? ' (te)' : '');
  if (text.textContent !== name) text.textContent = name;
  node.dataset.status = u.status || 'available';
  node.dataset.pose = u.pose || '';
  node.dataset.act = u.act || '';
  node.dataset.dir = dir;
  const hold = node.querySelector('.av-hold');
  const hEmoji = u.hold ? HOLD_EMOJI[u.hold] || '❔' : '';
  if (hold.textContent !== hEmoji) hold.textContent = hEmoji;
  const act = node.querySelector('.av-act');
  const aEmoji = u.act ? ACT_ICON[u.act] || '' : '';
  if (act.textContent !== aEmoji) act.textContent = aEmoji;
  node.classList.toggle('walking', !!u.moving && !u.pose);
  node.classList.toggle('muted', !u.mic);
  node.classList.toggle('in-call', !!u.call);
  if (!isMe) node.classList.toggle('no-conn', S.conn.get(u.id) === 'failed');
}

export const HOLD_EMOJI = {
  coffee: '☕', tea: '🍵', water: '🥤', soda: '🥤', juice: '🧃', apple: '🍎', banana: '🍌', cookie: '🍪', pizza: '🍕', cake: '🍰',
  popcorn: '🍿', toast: '🍞', sausage: '🌭', paper: '📄', book: '📘', chocolate: '🍫', chips: '🥨', icecream: '🍦', mug: '🫖', flower: '🌸',
};

function meUser() { return { ...S.me, ...S.local }; }

export function renderAvatars() {
  if (!sceneLayer || !S.me) return;
  const seen = new Set();
  let meNode = avatarEls.get(S.me.id);
  if (!meNode) { meNode = avatarNode(meUser(), true); avatarEls.set(S.me.id, meNode); }
  paintAvatar(meNode, meUser(), true);
  seen.add(S.me.id);
  for (const u of S.users.values()) {
    if (u.id === S.me.id || !u.online) continue;
    let node = avatarEls.get(u.id);
    if (!node) { node = avatarNode(u, false); avatarEls.set(u.id, node); }
    paintAvatar(node, u, false);
    seen.add(u.id);
  }
  for (const [id, node] of avatarEls) {
    if (!seen.has(id)) { node.remove(); avatarEls.delete(id); if (popover?.userId === id) closePopover(); }
  }
}

export function updateAvatar(userId) {
  const node = avatarEls.get(userId);
  if (!node) return renderAvatars();
  if (userId === S.me.id) paintAvatar(node, meUser(), true);
  else {
    const u = S.users.get(userId);
    if (u && u.online) paintAvatar(node, u, false); else renderAvatars();
  }
}

export function setSpeaking(userId, on) {
  avatarEls.get(userId)?.classList.toggle('speaking', on);
}

export function shake(userId) {
  const n = avatarEls.get(userId);
  if (!n) return;
  n.classList.remove('poked');
  void n.offsetWidth;
  n.classList.add('poked');
  setTimeout(() => n.classList.remove('poked'), 900);
}

/** Lebegő emoji az avatar fölött (integetés, taps, szív...). */
export function emote(userId, emoji) {
  const n = avatarEls.get(userId);
  if (!n) return;
  const b = el('span', { class: 'av-emote' }, emoji);
  n.append(b);
  setTimeout(() => b.remove(), 2600);
}

/** Lebegő effekt egy tárgy fölött (pl. 💧 locsoláskor, 💕 simogatáskor). */
export function itemEffect(uid, emoji, count = 1) {
  const it = S.items.find((i) => i.uid === uid);
  if (!it) return;
  const b = itemBox(it);
  for (let i = 0; i < count; i++) {
    const e = el('span', { class: 'fx', style: { left: b.x + b.w / 2 + (Math.random() - 0.5) * b.w * 0.6 + 'px', top: b.y + b.h * 0.3 + 'px', animationDelay: i * 0.15 + 's' } }, emoji);
    sceneLayer.append(e);
    e.style.zIndex = '99999';
    setTimeout(() => e.remove(), 2200 + i * 150);
  }
}

/** Konfetti egy szobában (vagy egy pont körül). */
export function confetti(x, y) {
  const cols = ['#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#4ade80', '#fb923c'];
  for (let i = 0; i < 40; i++) {
    const c = el('span', { class: 'confetti', style: { left: x + 'px', top: y + 'px', background: cols[i % cols.length], '--dx': (Math.random() - 0.5) * 260 + 'px', '--dy': (-Math.random() * 160 - 40) + 'px', '--r': Math.random() * 720 + 'deg', animationDelay: Math.random() * 0.2 + 's' } });
    c.style.zIndex = '99999';
    sceneLayer.append(c);
    setTimeout(() => c.remove(), 2000);
  }
}

// ---------------------------------------------------------------- mozgás

function onKeyDown(e) {
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('.overlay')) return;
  if (editing) return editorKey(e);
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = (e.key || '').toLowerCase();
  if (k === 'x' && nearItem) { e.preventDefault(); hooks.onItemClick?.(nearItem, true); return; }
  const d = KEY_DIR[k];
  if (!d) return;
  e.preventDefault();
  if (S.local.pose) hooks.onStand?.();
  if (!held.includes(d)) held.push(d);
  cancelPath();
  startLoop();
}

function onWorldMouseDown(e) {
  if (e.button !== 0) return;
  closePopover();
  if (editing) { select(null); return; }
  if (S.local.pose) hooks.onStand?.();
  walkTo(toWorld(e));
}

function cancelPath() {
  path = null;
  onArrive = null;
}

/** Odasétál egy pontra az akadályokat kikerülve. */
export function walkTo(p, arrive = null) {
  rebuildNav(); // az ajtók/kulcsok állapota közben változhatott
  const pts = nav.findPath({ x: S.local.x, y: S.local.y }, p);
  if (!pts) { toast('Oda nem lehet eljutni (zárt ajtó vagy akadály).'); return false; }
  path = pts;
  onArrive = arrive;
  stuckSince = 0;
  startLoop();
  return true;
}

/** Egy tárgy mellé sétál (a legközelebbi elérhető oldalára). */
export function walkToItem(it, arrive) {
  rebuildNav();
  const b = itemBox(it);
  if (distToBox(S.local.x, S.local.y, b) <= NEAR) { arrive?.(); return true; }
  const cand = [
    { x: b.x + b.w / 2, y: b.y + b.h + 14 }, { x: b.x + b.w / 2, y: b.y - 4 },
    { x: b.x - 12, y: b.y + b.h / 2 + 6 }, { x: b.x + b.w + 12, y: b.y + b.h / 2 + 6 },
  ].map((p) => nav.nearestFree(p.x, p.y, 4)).filter((p) => distToBox(p.x, p.y, b) <= NEAR + 4);
  cand.sort((p, q) => Math.hypot(p.x - S.local.x, p.y - S.local.y) - Math.hypot(q.x - S.local.x, q.y - S.local.y));
  for (const p of cand) {
    const pts = nav.findPath({ x: S.local.x, y: S.local.y }, p);
    if (pts) { path = pts; onArrive = arrive; stuckSince = 0; startLoop(); return true; }
  }
  toast('Ehhez most nem lehet odajutni.');
  return false;
}

function distToBox(x, y, b) {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
  const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

function startLoop() {
  if (rafId) return;
  lastT = performance.now();
  rafId = requestAnimationFrame(step);
}

// Egy lépés egy tengely mentén, ütközéssel. Igaz, ha sikerült lépni.
function tryMove(nx, ny) {
  const L = S.local;
  const stuck = !nav.isFree(L.x, L.y);
  const blocker = nav.blockerAt(nx, ny);
  if (!blocker || stuck) { L.x = nx; L.y = ny; return true; }
  if (blocker.door && performance.now() - lastBump > 600) {
    lastBump = performance.now();
    hooks.onBump?.(blocker.item);
  }
  return false;
}

// Csak mozgás közben fut, állás közben nem fogyaszt CPU-t.
function step(t) {
  const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000));
  lastT = t;
  const dist = SPEED * dt;
  const L = S.local;
  let dir = held[held.length - 1] || null;
  let moved = false;
  if (dir) {
    const nx = L.x + (dir === 'left' ? -dist : dir === 'right' ? dist : 0);
    const ny = L.y + (dir === 'up' ? -dist : dir === 'down' ? dist : 0);
    moved = tryMove(Math.max(8, Math.min(S.world.w - 8, nx)), Math.max(8, Math.min(S.world.h - 3, ny)));
  } else if (path && path.length) {
    const tgt = path[0];
    const dx = tgt.x - L.x, dy = tgt.y - L.y;
    const sp = dist * 1.25;
    if (Math.abs(dx) > 0.5) {
      dir = dx > 0 ? 'right' : 'left';
      moved = tryMove(Math.abs(dx) <= sp ? tgt.x : L.x + Math.sign(dx) * sp, L.y);
    } else if (Math.abs(dy) > 0.5) {
      dir = dy > 0 ? 'down' : 'up';
      moved = tryMove(L.x, Math.abs(dy) <= sp ? tgt.y : L.y + Math.sign(dy) * sp);
    } else {
      path.shift();
      moved = true;
    }
    if (!moved) {
      // akadály (pl. épp nyíló ajtó): kicsit várunk, aztán újratervezünk
      if (!stuckSince) stuckSince = t;
      else if (t - stuckSince > 900) {
        const final = path[path.length - 1];
        const cb = onArrive;
        stuckSince = 0;
        if (!walkTo(final, cb)) cancelPath();
      }
    } else stuckSince = 0;
    if (path && !path.length) {
      const cb = onArrive;
      cancelPath();
      cb?.();
    }
  }
  if (!Number.isFinite(L.x) || !Number.isFinite(L.y)) { const p = nav.nearestFree(S.world.w / 2, S.world.h / 2); L.x = p.x; L.y = p.y; cancelPath(); }
  if (dir) L.dir = dir;
  const active = held.length > 0 || !!(path && path.length);
  L.moving = active;
  if (moved) { L.x = Math.round(L.x * 10) / 10; L.y = Math.round(L.y * 10) / 10; }
  updateAvatar(S.me.id);
  if (moved) { hooks.onLocalMove?.(false); updateNear(); }
  if (active) rafId = requestAnimationFrame(step);
  else { rafId = 0; hooks.onLocalMove?.(true); updateNear(); }
}

/** A legközelebbi interakcióra képes tárgy kiemelése. */
export function updateNear() {
  if (editing) return;
  let best = null, bd = NEAR;
  for (const it of S.items) {
    if (!interactive(it)) continue;
    const d = distToBox(S.local.x, S.local.y - 4, itemBox(it));
    if (d <= bd) { bd = d; best = it; }
  }
  if (best === nearItem) return;
  if (nearItem) itemEls.get(nearItem.uid)?.classList.remove('near');
  nearItem = best;
  if (best) {
    itemEls.get(best.uid)?.classList.add('near');
    hintEl.textContent = '';
    hintEl.append(el('kbd', {}, 'X'), ' ', best.label && !CATALOG[best.type].hasLabel ? best.label : CATALOG[best.type].label);
    hintEl.classList.remove('hidden');
  } else hintEl.classList.add('hidden');
}

/** Leültetés egy ülőhelyre (a tárgy mellett állva). */
export function placeOnSeat(seat, it) {
  const L = S.local;
  L.x = seat.x; L.y = seat.y + 4; L.dir = seat.dir; L.pose = seat.pose; L.seat = it.uid;
  cancelPath();
  updateAvatar(S.me.id);
}

/** Felállás: ha tömör bútoron ült, a legközelebbi szabad helyre lép. */
export function standUp() {
  const L = S.local;
  L.pose = null; L.seat = null;
  if (!nav.isFree(L.x, L.y)) {
    const p = nav.nearestFree(L.x, L.y + 10);
    L.x = p.x; L.y = p.y;
  }
  updateAvatar(S.me.id);
}

export function seatTaken(it, seat) {
  for (const u of S.users.values()) {
    if (u.online && u.pose && u.seat === it.uid && Math.abs(u.x - seat.x) < 8 && Math.abs(u.y - (seat.y + 4)) < 8) return true;
  }
  return false;
}

export { seatsOf };

export function currentZoneId() {
  const z = zoneAt(S.local.x, S.local.y);
  return z ? z.id : null;
}

/** Biztosítja, hogy a saját avatar ne álljon falban/bútorban (pl. új térkép után). */
export function ensureFree() {
  if (S.local.pose) return;
  if (!nav.isFree(S.local.x, S.local.y)) {
    const p = nav.nearestFree(S.local.x, S.local.y);
    S.local.x = p.x; S.local.y = p.y;
    updateAvatar(S.me.id);
  }
}

// ---------------------------------------------------------------- felugró menü egy kollégán

function openPopover(userId) {
  closePopover();
  const u = S.users.get(userId);
  if (!u) return;
  const statusText = { available: 'Elérhető', busy: 'Elfoglalt', away: 'Távol' }[u.status] || '';
  const inCallWithMe = S.local.call === userId;
  const box = el('div', { class: 'popover card', onmousedown: (e) => e.stopPropagation() },
    el('div', { class: 'pop-head' }, el('strong', {}, u.name), el('span', { class: 'muted-text' }, statusText + (u.hold ? ` · kezében: ${HOLD_EMOJI[u.hold] || ''}` : ''))),
    S.conn.get(userId) === 'failed' ? el('div', { class: 'pop-warn' }, 'Nem sikerült hangkapcsolatot létesíteni vele.') : null,
    S.local.hold ? el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onGive?.(userId); } }, el('span', { class: 'emoji-ico' }, HOLD_EMOJI[S.local.hold] || '🎁'), el('span', {}, 'Odaadom neki')) : null,
    el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onPoke?.(userId); } }, el('span', { class: 'emoji-ico' }, '👉'), el('span', {}, 'Bökés')),
    el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onMessage?.(userId); }, html: `${ICONS.chat}<span>Üzenet</span>` }),
    inCallWithMe
      ? el('button', { class: 'btn block danger', onclick: () => { closePopover(); hooks.onEndCall?.(); }, html: `${ICONS.phoneOff}<span>Hívás vége</span>` })
      : el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onCall?.(userId); }, html: `${ICONS.phone}<span>Hívás (csak ketten)</span>` }),
    el('button', { class: 'btn block', onclick: () => { closePopover(); walkTo({ x: u.x + 30, y: u.y }); }, html: `${ICONS.walk}<span>Odamegyek</span>` }));
  openBoxAt(box, u.x + 22, u.y - FEET);
  popover = { userId, box };
}

/** Általános felugró doboz a térképen (tárgy-menühöz is). */
export function openBoxAt(box, x, y) {
  closePopover();
  sceneLayer.append(box);
  box.style.transform = `translate(${x}px, ${y}px) scale(${1 / Math.max(scale, 0.6)})`;
  box.style.transformOrigin = 'top left';
  box.style.zIndex = '100000';
  popover = { userId: null, box };
}

export function closePopover() {
  popover?.box.remove();
  popover = null;
}

// ---------------------------------------------------------------- szerkesztő

export function isEditing() { return !!editing; }
export function editState() { return editing; }

export function startEditing() {
  closePopover();
  if (nearItem) { itemEls.get(nearItem.uid)?.classList.remove('near'); nearItem = null; hintEl.classList.add('hidden'); }
  editing = {
    zones: S.zones.map((z) => ({ ...z })),
    items: S.items.map((it) => ({ ...it })),
    world: { w: S.world.w, h: S.world.h },
    tab: 'items',
    sel: null,
  };
  root.classList.add('editing');
  renderZones();
  renderItems();
}

export function stopEditing() {
  editing = null;
  root.classList.remove('editing', 'edit-zones', 'edit-items');
  renderZones();
  renderItems();
  renderAvatars();
}

export function setTab(tab) {
  if (!editing) return;
  editing.tab = tab;
  editing.sel = null;
  renderZones();
  renderItems();
  hooks.onEditSelect?.(null);
}

export function select(sel) {
  if (!editing) return;
  editing.sel = sel;
  renderZones();
  renderItems();
  hooks.onEditSelect?.(sel);
}

export function refreshEdit() {
  renderZones();
  renderItems();
}

function viewCenter() {
  const r = viewport.getBoundingClientRect();
  return toWorld({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
}

export function addZone() {
  if (!editing) return;
  const c = viewCenter();
  const z = { id: 0, name: 'Új szoba', kind: 'talk', x: Math.round(c.x - 160), y: Math.round(c.y - 110), w: 320, h: 220, color: '#22d3ee', floor: 'none' };
  editing.zones.push(z);
  select({ kind: 'zone', obj: z });
}

export function addItem(type) {
  if (!editing) return;
  const def = CATALOG[type];
  const c = viewCenter();
  const it = { uid: newUid(), type, x: Math.round(c.x - def.w / 2), y: Math.round(c.y - def.h / 2), w: def.w, h: def.h, rot: 0, color: '', label: def.hasLabel ? 'Felirat' : '', url: '' };
  editing.items.push(it);
  select({ kind: 'item', obj: it });
}

/** Falak a kijelölt szoba köré (ajtónyílással alul középen). */
export function wallsAroundZone() {
  const s = editing?.sel;
  if (s?.kind !== 'zone') return;
  const z = s.obj, T = 14;
  const mk = (type, x, y, w, h, rot = 0) => {
    const it = { uid: newUid(), type, x, y, w, h, rot, color: '', label: '', url: '' };
    editing.items.push(it);
  };
  const vert = (x, y1, y2, type = 'wall') => { const len = y2 - y1; mk(type, Math.round(x + T / 2 - len / 2), Math.round((y1 + y2) / 2 - T / 2), len, T, 90); };
  mk('wall', z.x - T, z.y - T, z.w + 2 * T, T);
  const mid = z.x + z.w / 2;
  mk('wall', z.x - T, z.y + z.h, mid - 30 - (z.x - T), T);
  mk('door', mid - 30, z.y + z.h, 60, T);
  mk('wall', mid + 30, z.y + z.h, z.x + z.w + T - (mid + 30), T);
  vert(z.x - T, z.y, z.y + z.h);
  vert(z.x + z.w, z.y, z.y + z.h);
  renderItems();
}

export function deleteSelected() {
  const s = editing?.sel;
  if (!s) return;
  if (s.kind === 'zone') editing.zones = editing.zones.filter((z) => z !== s.obj);
  else editing.items = editing.items.filter((i) => i !== s.obj);
  select(null);
}

export function duplicateSelected() {
  const s = editing?.sel;
  if (!s) return;
  if (s.kind === 'item') {
    const it = { ...s.obj, uid: newUid(), x: s.obj.x + 20, y: s.obj.y + 20 };
    editing.items.push(it);
    select({ kind: 'item', obj: it });
  } else {
    const z = { ...s.obj, id: 0, x: s.obj.x + 30, y: s.obj.y + 30, name: s.obj.name + ' (2)' };
    editing.zones.push(z);
    select({ kind: 'zone', obj: z });
  }
}

export function rotateSelected(delta = 90) {
  const s = editing?.sel;
  if (s?.kind !== 'item') return;
  s.obj.rot = (((s.obj.rot || 0) + delta) % 360 + 360) % 360;
  renderItems();
  hooks.onEditSelect?.(s);
}

export function reorderSelected(dir) {
  const s = editing?.sel;
  if (s?.kind !== 'item') return;
  const arr = editing.items;
  const i = arr.indexOf(s.obj);
  arr.splice(i, 1);
  if (dir > 0) arr.push(s.obj); else arr.unshift(s.obj);
  renderItems();
}

export function loadTemplate(tpl) {
  if (!editing) return;
  editing.zones = tpl.zones.map((z) => ({ ...z }));
  editing.items = tpl.items.map((i) => ({ ...i }));
  editing.world = { ...(tpl.world || { w: 1600, h: 1000 }) };
  select(null);
}

export function clearItems() {
  if (!editing) return;
  editing.items = [];
  select(null);
}

export function setWorldSize(w, h) {
  if (!editing) return;
  editing.world.w = Math.max(600, Math.min(6000, w | 0));
  editing.world.h = Math.max(400, Math.min(6000, h | 0));
  renderZones();
}

export async function saveEditing() {
  if (!editing) return false;
  try {
    const res = await api('map_save', {
      world: editing.world,
      zones: editing.zones.map(({ id, name, kind, x, y, w, h, color, floor }) => ({ id, name, kind, x, y, w, h, color, floor })),
      items: editing.items.map(({ uid, type, x, y, w, h, rot, color, label, url }) => ({ uid, type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), rot, color, label, url })),
    });
    S.world = res.world;
    S.zones = res.zones;
    S.items = res.items;
    stopEditing();
    ensureFree();
    toast('A térkép elmentve.', { type: 'ok' });
    return true;
  } catch (e) {
    toast('Nem sikerült menteni: ' + e.code, { type: 'error' });
    return false;
  }
}

function editorKey(e) {
  const k = (e.key || '').toLowerCase();
  const s = editing.sel;
  if ((e.metaKey || e.ctrlKey) && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (k === 'escape') { select(null); return; }
  if (!s) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelected(); return; }
  if (k === 'r' && s.kind === 'item') { e.preventDefault(); rotateSelected(e.shiftKey ? -90 : 90); return; }
  const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  if (d) {
    e.preventDefault();
    const st = e.shiftKey ? 10 : 1;
    s.obj.x += d[0] * st;
    s.obj.y += d[1] * st;
    refreshEdit();
  }
}

function startDrag(e, kind, obj, mode) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  if (editing.sel?.obj !== obj) select({ kind, obj });
  const start = toWorld(e);
  const orig = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
  const W = editing.world.w, H = editing.world.h;
  const grid = kind === 'zone' ? 10 : 2;
  const snap = (v, ev) => (ev.altKey ? Math.round(v) : Math.round(v / grid) * grid);
  let raf = 0;
  const move = (ev) => {
    const p = toWorld(ev);
    const dx = p.x - start.x, dy = p.y - start.y;
    if (mode === 'move') {
      obj.x = Math.max(kind === 'zone' ? 0 : -obj.w / 2, Math.min(W - (kind === 'zone' ? obj.w : obj.w / 2), snap(orig.x + dx, ev)));
      obj.y = Math.max(kind === 'zone' ? 0 : -obj.h / 2, Math.min(H - (kind === 'zone' ? obj.h : obj.h / 2), snap(orig.y + dy, ev)));
    } else {
      let rx = dx, ry = dy;
      const rot = kind === 'item' ? obj.rot || 0 : 0;
      if (rot === 90) { rx = dy; ry = -dx; } else if (rot === 180) { rx = -dx; ry = -dy; } else if (rot === 270) { rx = -dy; ry = dx; }
      const min = kind === 'zone' ? 60 : 8;
      obj.w = Math.max(min, Math.min(W, snap(orig.w + rx, ev)));
      obj.h = Math.max(min, Math.min(H, snap(orig.h + ry, ev)));
    }
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; refreshEdit(); });
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    hooks.onEditSelect?.(editing?.sel);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}
