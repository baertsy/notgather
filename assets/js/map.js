// A 2D iroda: szobák, avatarok, mozgás (nyilak/WASD vagy kattintás) és a szobaszerkesztő.

import { S, zoneAt } from './store.js';
import { el, esc, initials, ICONS, api, toast } from './util.js';

const AV = 40;          // avatar mérete
const SPEED = 260;      // px / mp

let root, viewport, world, zonesLayer, avatarsLayer, popover = null;
let scale = 1;
let hooks = {};
const avatarEls = new Map(); // userId -> element
const keys = new Set();
let target = null;          // kattintással kijelölt cél
let rafId = 0;
let lastT = 0;
let editing = null;         // szerkesztési állapot: { zones, world, selected }

export function initMap(container, h) {
  hooks = h;
  root = container;
  root.innerHTML = '';
  viewport = el('div', { class: 'viewport' });
  world = el('div', { class: 'world' });
  zonesLayer = el('div', { class: 'zones' });
  avatarsLayer = el('div', { class: 'avatars' });
  world.append(zonesLayer, avatarsLayer);
  viewport.append(world);
  root.append(viewport);

  new ResizeObserver(fit).observe(viewport);
  world.addEventListener('mousedown', onWorldMouseDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  renderZones();
  fit();
}

function fit() {
  if (!viewport) return;
  const W = editing ? editing.world.w : S.world.w;
  const H = editing ? editing.world.h : S.world.h;
  const r = viewport.getBoundingClientRect();
  scale = Math.min(r.width / W, r.height / H, 1.4);
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
  zonesLayer.innerHTML = '';
  for (const z of zones) {
    const node = el('div', {
      class: `zone ${z.kind === 'quiet' ? 'quiet' : ''} ${!editing && S.local.zone === z.id ? 'here' : ''} ${editing?.selected === z ? 'selected' : ''}`,
      style: { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px', '--zc': z.color },
    }, el('div', { class: 'zone-label' }, (z.kind === 'quiet' ? '🤫 ' : '') + z.name));
    if (editing) {
      node.addEventListener('mousedown', (e) => startZoneDrag(e, z, 'move'));
      const handle = el('div', { class: 'zone-handle' });
      handle.addEventListener('mousedown', (e) => startZoneDrag(e, z, 'resize'));
      node.append(handle);
    }
    zonesLayer.append(node);
  }
  fit();
}

// ---------------------------------------------------------------- avatarok

function avatarNode(u, isMe) {
  const node = el('div', { class: `avatar ${isMe ? 'me' : ''}`, 'data-id': u.id },
    el('div', { class: 'av-bubble' }),
    el('div', { class: 'av-name' }),
    el('span', { class: 'av-status' }),
    el('span', { class: 'av-mic', html: ICONS.micOff }),
    el('span', { class: 'av-warn', title: 'Nincs hangkapcsolat vele', html: ICONS.warn }),
    el('span', { class: 'av-call', html: ICONS.phone }));
  if (!isMe) node.addEventListener('mousedown', (e) => { e.stopPropagation(); if (!editing) openPopover(u.id); });
  avatarsLayer.append(node);
  return node;
}

function paintAvatar(node, u, isMe) {
  node.style.transform = `translate(${u.x - AV / 2}px, ${u.y - AV / 2}px)`;
  const bubble = node.firstChild;
  const label = u.emoji || initials(u.name);
  if (bubble.textContent !== label) bubble.textContent = label;
  bubble.style.background = u.color;
  const name = node.children[1];
  if (name.textContent !== u.name) name.textContent = u.name + (isMe ? ' (te)' : '');
  node.dataset.status = u.status || 'available';
  node.classList.toggle('muted', !u.mic);
  node.classList.toggle('in-call', !!u.call);
  if (!isMe) {
    const c = S.conn.get(u.id);
    node.classList.toggle('no-conn', c === 'failed');
  }
}

export function renderAvatars() {
  if (!avatarsLayer || !S.me) return;
  const seen = new Set();
  const meU = { ...S.me, ...S.local };
  let meNode = avatarEls.get(S.me.id);
  if (!meNode) { meNode = avatarNode(meU, true); avatarEls.set(S.me.id, meNode); }
  paintAvatar(meNode, meU, true);
  seen.add(S.me.id);
  for (const u of S.users.values()) {
    if (u.id === S.me.id || !u.online) continue;
    let node = avatarEls.get(u.id);
    if (!node) {
      node = avatarNode(u, false);
      node.classList.add('remote');
      avatarEls.set(u.id, node);
    }
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
  if (userId === S.me.id) paintAvatar(node, { ...S.me, ...S.local }, true);
  else { const u = S.users.get(userId); if (u && u.online) paintAvatar(node, u, false); else renderAvatars(); }
}

export function setSpeaking(userId, on) {
  avatarEls.get(userId)?.classList.toggle('speaking', on);
}

// ---------------------------------------------------------------- mozgás

function onKeyDown(e) {
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('.overlay')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
    e.preventDefault();
    if (editing) return;
    keys.add(k);
    target = null;
    startLoop();
  }
}

function onWorldMouseDown(e) {
  if (e.button !== 0) return;
  closePopover();
  if (editing) {
    editing.selected = null;
    renderZones();
    hooks.onEditSelect?.(null);
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
    x: Math.max(AV / 2, Math.min(S.world.w - AV / 2, x)),
    y: Math.max(AV / 2, Math.min(S.world.h - AV / 2, y)),
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
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  let moved = false;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const p = clampPos(S.local.x + (dx / len) * SPEED * dt, S.local.y + (dy / len) * SPEED * dt);
    moved = p.x !== S.local.x || p.y !== S.local.y;
    S.local.x = p.x; S.local.y = p.y;
  } else if (target) {
    const vx = target.x - S.local.x, vy = target.y - S.local.y;
    const dist = Math.hypot(vx, vy);
    const stepLen = SPEED * 1.4 * dt;
    if (dist < 0.5 || dist <= stepLen) { S.local.x = target.x; S.local.y = target.y; target = null; }
    else { S.local.x += (vx / dist) * stepLen; S.local.y += (vy / dist) * stepLen; }
    moved = true;
  }
  if (!Number.isFinite(S.local.x) || !Number.isFinite(S.local.y)) { S.local.x = S.world.w / 2; S.local.y = S.world.h / 2; target = null; }
  if (moved) {
    S.local.x = Math.round(S.local.x * 10) / 10;
    S.local.y = Math.round(S.local.y * 10) / 10;
    updateAvatar(S.me.id);
    hooks.onLocalMove?.();
  }
  if (keys.size || target) rafId = requestAnimationFrame(step);
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
  const node = avatarEls.get(userId);
  const statusText = { available: 'Elérhető', busy: 'Elfoglalt', away: 'Távol' }[u.status] || '';
  const inCallWithMe = S.local.call === userId;
  const box = el('div', { class: 'popover card', onmousedown: (e) => e.stopPropagation() },
    el('div', { class: 'pop-head' }, el('strong', {}, u.name), el('span', { class: 'muted-text' }, statusText)),
    S.conn.get(userId) === 'failed' ? el('div', { class: 'pop-warn' }, 'Nem sikerült hangkapcsolatot létesíteni vele.') : null,
    el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onMessage?.(userId); }, html: `${ICONS.chat}<span>Üzenet</span>` }),
    inCallWithMe
      ? el('button', { class: 'btn block danger', onclick: () => { closePopover(); hooks.onEndCall?.(); }, html: `${ICONS.phoneOff}<span>Hívás vége</span>` })
      : el('button', { class: 'btn block', onclick: () => { closePopover(); hooks.onCall?.(userId); }, html: `${ICONS.phone}<span>Hívás (csak ketten)</span>` }),
    el('button', { class: 'btn block', onclick: () => { closePopover(); walkTo({ x: u.x + AV, y: u.y }); }, html: `${ICONS.walk}<span>Odamegyek</span>` }));
  avatarsLayer.append(box);
  box.style.transform = `translate(${u.x + AV / 2 + 6}px, ${u.y - AV / 2}px) scale(${1 / Math.max(scale, 0.6)})`;
  box.style.transformOrigin = 'top left';
  popover = { userId, box, node };
}

function closePopover() {
  popover?.box.remove();
  popover = null;
}

// ---------------------------------------------------------------- szerkesztő (admin)

export function isEditing() {
  return !!editing;
}

export function startEditing() {
  closePopover();
  editing = {
    zones: S.zones.map((z) => ({ ...z })),
    world: { w: S.world.w, h: S.world.h },
    selected: null,
  };
  root.classList.add('editing');
  renderZones();
}

export function stopEditing() {
  editing = null;
  root.classList.remove('editing');
  renderZones();
}

export function editState() {
  return editing;
}

export function addZone() {
  if (!editing) return;
  const z = { id: 0, name: 'Új szoba', kind: 'talk', x: 80, y: 80, w: 320, h: 220, color: '#22d3ee', _key: Math.random() };
  editing.zones.push(z);
  editing.selected = z;
  renderZones();
  hooks.onEditSelect?.(z);
}

export function deleteSelectedZone() {
  if (!editing?.selected) return;
  editing.zones = editing.zones.filter((z) => z !== editing.selected);
  editing.selected = null;
  renderZones();
  hooks.onEditSelect?.(null);
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
      zones: editing.zones.map(({ id, name, kind, x, y, w, h, color }) => ({ id, name, kind, x, y, w, h, color })),
    });
    S.world = res.world;
    S.zones = res.zones;
    stopEditing();
    toast('A térkép elmentve.', { type: 'ok' });
    return true;
  } catch (e) {
    toast('Nem sikerült menteni: ' + e.code, { type: 'error' });
    return false;
  }
}

function startZoneDrag(e, z, mode) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  editing.selected = z;
  hooks.onEditSelect?.(z);
  const start = toWorld(e);
  const orig = { x: z.x, y: z.y, w: z.w, h: z.h };
  const grid = 10;
  const snap = (v) => Math.round(v / grid) * grid;
  const move = (ev) => {
    const p = toWorld(ev);
    const dx = p.x - start.x, dy = p.y - start.y;
    if (mode === 'move') {
      z.x = Math.max(0, Math.min(editing.world.w - z.w, snap(orig.x + dx)));
      z.y = Math.max(0, Math.min(editing.world.h - z.h, snap(orig.y + dy)));
    } else {
      z.w = Math.max(60, Math.min(editing.world.w - z.x, snap(orig.w + dx)));
      z.h = Math.max(60, Math.min(editing.world.h - z.y, snap(orig.h + dy)));
    }
    renderZones();
  };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  renderZones();
}

export { esc };
