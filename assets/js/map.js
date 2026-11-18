// A 2D iroda: szobák, bútorok, avatarok, mozgás és a szerkesztő logikája.

import { S, zoneAt } from './store.js';
import { el, ICONS, api, toast } from './util.js';
import { avatarSVG } from './avatar.js';
import { CATALOG, itemSVG } from './furniture.js';

const SPEED = 230;          // px / mp
const FIG_W = 36, FIG_H = 50, FEET = 46;

let root, viewport, world, zonesLayer, itemsLayer, labelsLayer, avatarsLayer, popover = null;
let scale = 1;
let hooks = {};
const avatarEls = new Map(); // userId -> element
const held = [];            // lenyomott irányok, a legutóbbi a végén
let target = null;          // kattintással kijelölt cél
let rafId = 0;
let lastT = 0;
let editing = null;         // { zones, items, world, tab, sel: {kind, obj} }

const KEY_DIR = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export function initMap(container, h) {
  hooks = h;
  root = container;
  root.innerHTML = '';
  viewport = el('div', { class: 'viewport' });
  world = el('div', { class: 'world' });
  zonesLayer = el('div', { class: 'zones' });
  itemsLayer = el('div', { class: 'items' });
  labelsLayer = el('div', { class: 'labels' });
  avatarsLayer = el('div', { class: 'avatars' });
  world.append(zonesLayer, itemsLayer, labelsLayer, avatarsLayer);
  viewport.append(world);
  root.append(viewport);

  new ResizeObserver(fit).observe(viewport);
  world.addEventListener('mousedown', onWorldMouseDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => {
    const d = KEY_DIR[(e.key || '').toLowerCase()];
    const i = d ? held.indexOf(d) : -1;
    if (i >= 0) held.splice(i, 1);
  });
  window.addEventListener('blur', () => { held.length = 0; });
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

// ---------------------------------------------------------------- szobák

export function renderZones() {
  if (!zonesLayer) return;
  const zones = editing ? editing.zones : S.zones;
  const editZones = editing && editing.tab === 'zones';
  zonesLayer.innerHTML = '';
  labelsLayer.innerHTML = '';
  for (const z of zones) {
    const sel = editing?.sel?.obj === z;
    const node = el('div', {
      class: `zone floor-${z.floor || 'none'} ${z.kind === 'quiet' ? 'quiet' : ''} ${!editing && S.local.zone === z.id ? 'here' : ''} ${sel ? 'selected' : ''}`,
      style: { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px', '--zc': z.color },
    });
    // a felirat külön rétegben, a bútorok fölött
    labelsLayer.append(el('div', { class: 'zone-label', style: { left: z.x + 12 + 'px', top: z.y + 10 + 'px' } }, (z.kind === 'quiet' ? '🤫 ' : '') + z.name));
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

// ---------------------------------------------------------------- bútorok

export function renderItems() {
  if (!itemsLayer) return;
  const items = editing ? editing.items : S.items || [];
  const editItems = editing && editing.tab === 'items';
  itemsLayer.innerHTML = '';
  const ordered = items.map((it, i) => [it, i]).sort((a, b) => ((CATALOG[a[0].type]?.layer ?? 1) - (CATALOG[b[0].type]?.layer ?? 1)) || a[1] - b[1]);
  for (const [it] of ordered) {
    const def = CATALOG[it.type];
    if (!def) continue;
    const sel = editing?.sel?.obj === it;
    const node = el('div', {
      class: `item ${sel ? 'selected' : ''}`,
      style: { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px', transform: it.rot ? `rotate(${it.rot}deg)` : '' },
      html: itemSVG(it),
    });
    if (editItems) {
      node.addEventListener('mousedown', (e) => startDrag(e, 'item', it, 'move'));
      if (def.resizable) {
        const handle = el('div', { class: 'handle' });
        handle.addEventListener('mousedown', (e) => startDrag(e, 'item', it, 'resize'));
        node.append(handle);
      }
    }
    itemsLayer.append(node);
  }
  root?.classList.toggle('edit-items', !!editItems);
}

// ---------------------------------------------------------------- avatarok

function avatarNode(u, isMe) {
  const node = el('div', { class: `avatar ${isMe ? 'me' : 'remote'}`, 'data-id': u.id },
    el('div', { class: 'av-ring' }),
    el('div', { class: 'av-fig' }),
    el('div', { class: 'av-name' }, el('span', { class: 'av-dot' }), el('span', { class: 'av-text' })),
    el('span', { class: 'av-mic', html: ICONS.micOff }),
    el('span', { class: 'av-warn', title: 'Nincs hangkapcsolat vele', html: ICONS.warn }),
    el('span', { class: 'av-call', html: ICONS.phone }));
  if (!isMe) node.addEventListener('mousedown', (e) => { e.stopPropagation(); if (!editing) openPopover(u.id); });
  avatarsLayer.append(node);
  return node;
}

function paintAvatar(node, u, isMe) {
  node.style.transform = `translate(${u.x - FIG_W / 2}px, ${u.y - FEET}px)`;
  node.style.zIndex = String(10 + Math.round(u.y));
  const dir = u.dir || 'down';
  const key = JSON.stringify(u.avatar || null) + dir;
  if (node._key !== key) {
    node._key = key;
    node.children[1].innerHTML = avatarSVG(u.avatar, dir);
  }
  const text = node.querySelector('.av-text');
  const name = u.name + (isMe ? ' (te)' : '');
  if (text.textContent !== name) text.textContent = name;
  node.dataset.status = u.status || 'available';
  node.classList.toggle('walking', !!u.moving);
  node.classList.toggle('muted', !u.mic);
  node.classList.toggle('in-call', !!u.call);
  if (!isMe) node.classList.toggle('no-conn', S.conn.get(u.id) === 'failed');
}

function meUser() {
  return { ...S.me, ...S.local };
}

export function renderAvatars() {
  if (!avatarsLayer || !S.me) return;
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

// Rázkódás, ha valakit megböknek
export function shake(userId) {
  const n = avatarEls.get(userId);
  if (!n) return;
  n.classList.remove('poked');
  void n.offsetWidth;
  n.classList.add('poked');
  setTimeout(() => n.classList.remove('poked'), 900);
}

// ---------------------------------------------------------------- mozgás (csak fel/le/jobbra/balra)

function onKeyDown(e) {
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('.overlay')) return;
  if (editing) return editorKey(e);
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const d = KEY_DIR[(e.key || '').toLowerCase()];
  if (!d) return;
  e.preventDefault();
  if (!held.includes(d)) held.push(d);
  target = null;
  startLoop();
}

function onWorldMouseDown(e) {
  if (e.button !== 0) return;
  closePopover();
  if (editing) {
    select(null);
    return;
  }
  walkTo(toWorld(e));
}

export function walkTo(p) {
  target = clampPos(p.x, p.y);
  startLoop();
}

function clampPos(x, y) {
  return {
    x: Math.max(14, Math.min(S.world.w - 14, x)),
    y: Math.max(40, Math.min(S.world.h - 6, y)),
  };
}

function startLoop() {
  if (rafId) return;
  lastT = performance.now();
  rafId = requestAnimationFrame(step);
}

// Csak mozgás közben fut, állás közben nem fogyaszt CPU-t.
function step(t) {
  const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000));
  lastT = t;
  const dist = SPEED * dt;
  let dir = held[held.length - 1] || null;
  let moved = false;
  const L = S.local;
  if (dir) {
    const p = clampPos(L.x + (dir === 'left' ? -dist : dir === 'right' ? dist : 0), L.y + (dir === 'up' ? -dist : dir === 'down' ? dist : 0));
    moved = p.x !== L.x || p.y !== L.y;
    L.x = p.x; L.y = p.y;
  } else if (target) {
    // L alakú út: előbb vízszintesen, aztán függőlegesen
    const dx = target.x - L.x, dy = target.y - L.y;
    const sp = dist * 1.3;
    if (Math.abs(dx) > 0.5) {
      dir = dx > 0 ? 'right' : 'left';
      L.x = Math.abs(dx) <= sp ? target.x : L.x + Math.sign(dx) * sp;
      moved = true;
    } else if (Math.abs(dy) > 0.5) {
      dir = dy > 0 ? 'down' : 'up';
      L.x = target.x;
      L.y = Math.abs(dy) <= sp ? target.y : L.y + Math.sign(dy) * sp;
      moved = true;
    } else {
      L.x = target.x; L.y = target.y; target = null;
    }
  }
  if (!Number.isFinite(L.x) || !Number.isFinite(L.y)) { L.x = S.world.w / 2; L.y = S.world.h / 2; target = null; }
  if (dir) L.dir = dir;
  const active = held.length > 0 || !!target;
  L.moving = active;
  if (moved) {
    L.x = Math.round(L.x * 10) / 10;
    L.y = Math.round(L.y * 10) / 10;
  }
  updateAvatar(S.me.id);
  if (moved) hooks.onLocalMove?.(false);
  if (active) rafId = requestAnimationFrame(step);
  else { rafId = 0; hooks.onLocalMove?.(true); }
}

export function currentZoneId() {
  const z = zoneAt(S.local.x, S.local.y);
  return z ? z.id : null;
}

// ---------------------------------------------------------------- felugró menü egy kollégán

function openPopover(userId) {
  closePopover();
  const u = S.users.get(userId);
  if (!u) return;
  const statusText = { available: 'Elérhető', busy: 'Elfoglalt', away: 'Távol' }[u.status] || '';
  const inCallWithMe = S.local.call === userId;
  const box = el('div', { class: 'popover card', onmousedown: (e) => e.stopPropagation() },
    el('div', { class: 'pop-head' }, el('strong', {}, u.name), el('span', { class: 'muted-text' }, statusText)),
    S.conn.get(userId) === 'failed' ? el('div', { class: 'pop-warn' }, 'Nem sikerült hangkapcsolatot létesíteni vele.') : null,
    el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onPoke?.(userId); } }, el('span', { class: 'emoji-ico' }, '👉'), el('span', {}, 'Bökés')),
    el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onMessage?.(userId); }, html: `${ICONS.chat}<span>Üzenet</span>` }),
    inCallWithMe
      ? el('button', { class: 'btn block danger', onclick: () => { closePopover(); hooks.onEndCall?.(); }, html: `${ICONS.phoneOff}<span>Hívás vége</span>` })
      : el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onCall?.(userId); }, html: `${ICONS.phone}<span>Hívás (csak ketten)</span>` }),
    el('button', { class: 'btn block', onclick: () => { closePopover(); walkTo({ x: u.x + 34, y: u.y }); }, html: `${ICONS.walk}<span>Odamegyek</span>` }));
  avatarsLayer.append(box);
  box.style.transform = `translate(${u.x + 22}px, ${u.y - FEET}px) scale(${1 / Math.max(scale, 0.6)})`;
  box.style.transformOrigin = 'top left';
  box.style.zIndex = '100000';
  popover = { userId, box };
}

function closePopover() {
  popover?.box.remove();
  popover = null;
}

// ---------------------------------------------------------------- szerkesztő

export function isEditing() { return !!editing; }
export function editState() { return editing; }

export function startEditing() {
  closePopover();
  editing = {
    zones: S.zones.map((z) => ({ ...z })),
    items: (S.items || []).map((it) => ({ ...it })),
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

// A látható terület közepe (ide kerül az új tárgy)
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
  const it = { type, x: Math.round(c.x - def.w / 2), y: Math.round(c.y - def.h / 2), w: def.w, h: def.h, rot: 0, color: '', label: def.hasLabel ? 'Felirat' : '' };
  editing.items.push(it);
  select({ kind: 'item', obj: it });
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
    const it = { ...s.obj, x: s.obj.x + 20, y: s.obj.y + 20 };
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

// Előrébb/hátrébb hozás (rétegen belül)
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
  editing.world = { w: 1600, h: 1000 };
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
      items: editing.items.map(({ type, x, y, w, h, rot, color, label }) => ({ type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), rot, color, label })),
    });
    S.world = res.world;
    S.zones = res.zones;
    S.items = res.items;
    stopEditing();
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
    const step = e.shiftKey ? 10 : 1;
    s.obj.x += d[0] * step;
    s.obj.y += d[1] * step;
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
  const grid = kind === 'zone' ? 10 : 5;
  const snap = (v, ev) => (ev.altKey ? Math.round(v) : Math.round(v / grid) * grid);
  let raf = 0;
  const move = (ev) => {
    const p = toWorld(ev);
    const dx = p.x - start.x, dy = p.y - start.y;
    if (mode === 'move') {
      obj.x = Math.max(kind === 'zone' ? 0 : -obj.w / 2, Math.min(W - (kind === 'zone' ? obj.w : obj.w / 2), snap(orig.x + dx, ev)));
      obj.y = Math.max(kind === 'zone' ? 0 : -obj.h / 2, Math.min(H - (kind === 'zone' ? obj.h : obj.h / 2), snap(orig.y + dy, ev)));
    } else {
      // elforgatott tárgynál a húzás iránya is forog
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
