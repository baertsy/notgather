// Chat: közös csatorna, szobánkénti csatorna és privát üzenetek.

import { S, emit, on, convKeyOf, zoneById } from './store.js';
import { el, api, linkify, timeLabel, ICONS, toast, initials } from './util.js';

let panel, listEl, msgsEl, inputEl, titleEl;
let open = false;
let current = 'g';
let hooks = {};

export function initChat(container, h) {
  hooks = h;
  panel = el('aside', { class: 'chat card hidden' });
  titleEl = el('div', { class: 'chat-title' });
  listEl = el('div', { class: 'chat-list' });
  msgsEl = el('div', { class: 'chat-msgs' });
  inputEl = el('textarea', { rows: 1, placeholder: 'Üzenet… (Enter: küldés, Shift+Enter: új sor)', maxlength: 4000 });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inputEl.addEventListener('input', autoGrow);
  panel.append(
    el('div', { class: 'chat-head' }, titleEl, el('button', { class: 'icon-btn', title: 'Bezárás', onclick: () => setOpen(false), html: ICONS.close })),
    el('div', { class: 'chat-body' }, listEl, el('div', { class: 'chat-main' }, msgsEl,
      el('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); send(); } }, inputEl,
        el('button', { class: 'icon-btn primary', type: 'submit', title: 'Küldés', html: ICONS.send })))));
  container.append(panel);
  on('messages', () => { renderList(); renderMessages(); });
  on('users', renderList);
  on('zone', () => { renderList(); if (current.startsWith('z:')) renderMessages(); });
}

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(120, inputEl.scrollHeight) + 'px';
}

export function isOpen() { return open; }

export function setOpen(v) {
  open = v;
  panel.classList.toggle('hidden', !v);
  if (v) { markRead(current); renderList(); renderMessages(); setTimeout(() => inputEl.focus(), 30); }
  emit('chatOpen', v);
}

export function toggle() { setOpen(!open); }

export function openConversation(key) {
  current = key;
  setOpen(true);
}

function convs() {
  const list = [{ key: 'g', label: '# Mindenki' }];
  if (S.local.zone != null) {
    const z = zoneById(S.local.zone);
    if (z) list.push({ key: 'z:' + z.id, label: '# ' + z.name, hint: 'itt' });
  }
  // egyéb szobák, ahol van üzenet
  const zoneKeys = new Set(S.messages.filter((m) => m.scope === 'zone').map((m) => 'z:' + m.targetId));
  for (const k of zoneKeys) {
    if (list.some((c) => c.key === k)) continue;
    const z = zoneById(Number(k.slice(2)));
    if (z) list.push({ key: k, label: '# ' + z.name });
  }
  const people = [...S.users.values()].filter((u) => u.id !== S.me.id)
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name, 'hu'));
  for (const u of people) list.push({ key: 'd:' + u.id, label: u.name, user: u });
  return list;
}

let listKey = '';
function renderList() {
  if (!listEl || !S.me) return;
  const items = convs();
  const key = JSON.stringify([current, items.map((c) => [c.key, c.label, c.user?.online, c.user?.color, c.user?.emoji, S.unread.get(c.key) || 0])]);
  if (key === listKey) return;
  listKey = key;
  listEl.innerHTML = '';
  for (const c of items) {
    const n = S.unread.get(c.key) || 0;
    const item = el('button', { class: `chat-conv ${c.key === current ? 'active' : ''} ${c.user && !c.user.online ? 'offline' : ''}`, onclick: () => { current = c.key; markRead(c.key); renderList(); renderMessages(); inputEl.focus(); } },
      c.user ? el('span', { class: 'mini-av', style: { background: c.user.color } }, c.user.emoji || initials(c.user.name)) : null,
      el('span', { class: 'conv-label' }, c.label),
      n ? el('span', { class: 'badge' }, n > 99 ? '99+' : n) : null);
    listEl.append(item);
  }
}

function titleOf(key) {
  if (key === 'g') return 'Mindenki';
  if (key.startsWith('z:')) return 'Szoba: ' + (zoneById(Number(key.slice(2)))?.name || '?');
  return S.users.get(Number(key.slice(2)))?.name || 'Privát';
}

function renderMessages() {
  if (!open || !msgsEl) return;
  titleEl.textContent = titleOf(current);
  const nearBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 80;
  const msgs = S.messages.filter((m) => convKeyOf(m, S.me.id) === current).slice(-200);
  msgsEl.innerHTML = '';
  if (!msgs.length) msgsEl.append(el('div', { class: 'chat-empty' }, 'Még nincs üzenet.'));
  let prev = null;
  for (const m of msgs) {
    const mine = m.senderId === S.me.id;
    const sender = mine ? S.me : S.users.get(m.senderId);
    const grouped = prev && prev.senderId === m.senderId && m.at - prev.at < 300;
    msgsEl.append(el('div', { class: `msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}` },
      grouped ? null : el('div', { class: 'msg-meta' }, el('strong', {}, sender?.name || '?'), ' ', el('span', {}, timeLabel(m.at))),
      el('div', { class: 'msg-body', html: linkify(m.body).replace(/\n/g, '<br>') })));
    prev = m;
  }
  if (nearBottom || msgs.length < 30) msgsEl.scrollTop = msgsEl.scrollHeight;
  markRead(current);
}

function markRead(key) {
  if (S.unread.get(key)) { S.unread.delete(key); emit('unread'); renderList(); }
}

async function send() {
  const body = inputEl.value.trim();
  if (!body) return;
  let scope = 'global', targetId = 0;
  if (current.startsWith('z:')) { scope = 'zone'; targetId = Number(current.slice(2)); }
  else if (current.startsWith('d:')) { scope = 'dm'; targetId = Number(current.slice(2)); }
  inputEl.value = '';
  autoGrow();
  try {
    const res = await api('chat_send', { scope, targetId, body });
    addMessages([res.message], { fromSelf: true });
    hooks.onSent?.(res.message);
  } catch (e) {
    inputEl.value = body;
    toast('Nem sikerült elküldeni az üzenetet.', { type: 'error' });
  }
}

/** Új üzenetek felvétele (PHP-ból vagy adatcsatornán). Duplikátumokat kiszűri. */
export function addMessages(list, { fromSelf = false, silent = false } = {}) {
  let added = 0;
  for (const m of list) {
    if (!m || S.msgIds.has(m.id)) continue;
    S.msgIds.add(m.id);
    S.messages.push(m);
    if (m.id > S.lastMsgId) S.lastMsgId = m.id;
    added++;
    if (fromSelf || silent || m.senderId === S.me.id) continue;
    const key = convKeyOf(m, S.me.id);
    // Más szobák beszélgetéseiről nem jelzünk olvasatlant.
    if (m.scope === 'zone' && m.targetId !== S.local.zone) continue;
    const visible = open && key === current && !document.hidden;
    if (!visible) {
      S.unread.set(key, (S.unread.get(key) || 0) + 1);
      hooks.onIncoming?.(m, key);
    }
  }
  if (added) {
    S.messages.sort((a, b) => a.id - b.id);
    if (S.messages.length > 2000) {
      for (const m of S.messages.splice(0, S.messages.length - 2000)) S.msgIds.delete(m.id);
    }
    emit('messages');
    emit('unread');
  }
}

export function totalUnread() {
  let n = 0;
  for (const v of S.unread.values()) n += v;
  return n;
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && open) markRead(current); });
