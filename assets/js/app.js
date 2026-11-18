// Belépés, szinkron a szerverrel, WebRTC kapcsolatok és minden, ami ezeket összeköti.

import { S, emit, on, audible, meAsUser, zoneById } from './store.js';
import { $, el, api, uid, toast, bgTimeout, ICONS } from './util.js';
import { PeerManager } from './rtc.js';
import * as media from './media.js';
import * as map from './map.js';
import * as chat from './chat.js';
import * as ui from './ui.js';

S.peerId = uid(20);

let pm = null;
const outbox = [];
let syncing = false;
let syncAgain = false;
let cancelSync = null;
let firstSync = true;
let failures = 0;
let stopped = false;
const gonePeers = new Set();

const remoteAudio = new Map(); // userId -> { audio, meter, track }
const remoteVideo = new Map(); // userId -> { cam, screen }

// ======================================================================= indulás

async function boot() {
  let me;
  try {
    me = await api('me');
  } catch (e) {
    if (e.status === 401) return showLogin();
    if (e.code === 'not_configured') return showFatal('A szerver még nincs beállítva. Futtasd az install.php-t.');
    return showFatal('Nem érem el a szervert. Próbáld újra később.', true);
  }
  applyMe(me);
  showEnter();
}

function applyMe(me) {
  S.me = me.user;
  S.appName = me.appName;
  S.iceServers = me.iceServers;
  S.world = me.world;
  S.zones = me.zones;
  S.items = me.items || [];
  document.title = S.appName;
  if (me.lastPos) { S.local.x = me.lastPos.x; S.local.y = me.lastPos.y; }
  else {
    const z = S.zones[0];
    S.local.x = z ? z.x + z.w / 2 : S.world.w / 2;
    S.local.y = z ? z.y + z.h / 2 : S.world.h / 2;
  }
  S.local.x = Math.max(20, Math.min(S.world.w - 20, S.local.x));
  S.local.y = Math.max(20, Math.min(S.world.h - 20, S.local.y));
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

function showLogin() {
  showScreen('login');
  const form = $('#login-form');
  const err = $('#login-error');
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await api('login', { username: form.username.value.trim().toLowerCase(), password: form.password.value });
      const me = await api('me');
      applyMe(me);
      // A belépés gomb megnyomása elég felhasználói művelet a hanghoz is.
      enterOffice();
    } catch (ex) {
      err.textContent = ex.code === 'invalid_login' ? 'Hibás felhasználónév vagy jelszó.' : 'Nem sikerült belépni (' + ex.code + ').';
    } finally {
      btn.disabled = false;
    }
  };
  setTimeout(() => form.username.focus(), 50);
}

function showEnter() {
  showScreen('enter');
  $('#enter-name').textContent = S.me.name;
  $('#enter-btn').onclick = () => enterOffice();
  $('#enter-logout').onclick = () => logout();
}

function showFatal(text, retry = false) {
  showScreen('fatal');
  $('#fatal-text').textContent = text;
  $('#fatal-retry').classList.toggle('hidden', !retry);
  $('#fatal-retry').onclick = () => location.reload();
}

async function enterOffice() {
  showScreen('app');
  media.audioContext();
  await media.startMic();
  S.local.mic = !!media.local.micTrack && !media.prefs.micMuted;
  if (media.local.micError) micErrorToast();
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch { /* */ }
  }

  pm = new PeerManager({
    peerId: S.peerId,
    iceServers: S.iceServers,
    sendSignal: (to, data) => { outbox.push({ to, data, at: Date.now() }); requestSync(); },
    policy: (userId) => {
      const ok = audible(meAsUser(), S.users.get(userId));
      return { audio: ok, video: ok };
    },
    localTracks: () => ({
      audio: media.local.micTrack,
      cam: S.local.cam ? media.local.camTrack : null,
      screen: S.local.screen ? media.local.screenTrack : null,
    }),
    onPeerState: (peer, state) => {
      if (state === 'closed') { if (!pm.peerByUser(peer.userId)) S.conn.delete(peer.userId); }
      else S.conn.set(peer.userId, state);
      map.updateAvatar(peer.userId);
    },
    onChannelOpen: (peer) => {
      S.conn.set(peer.userId, 'connected');
      peer.send({ t: 'state', ...publicState() });
      map.updateAvatar(peer.userId);
      refreshMedia();
    },
    onChannelClose: (peer) => { map.updateAvatar(peer.userId); },
    onData: onPeerData,
    onRemoteTrack,
    onRemoteGone: (peer) => removeRemoteMedia(peer.userId),
  });

  map.initMap($('#map'), {
    onLocalMove,
    onMessage: (id) => chat.openConversation('d:' + id),
    onCall: startCall,
    onEndCall: endCall,
    onPoke: sendPoke,
    onEditSelect: (z) => ui.renderEditPanel(z),
  });
  chat.initChat($('#app'), {
    onSent: (m) => {
      if (m.scope === 'dm') pm.sendToUser(m.targetId, { t: 'chat', m });
      else pm.broadcast({ t: 'chat', m });
    },
    onIncoming: notifyIncoming,
  });
  ui.initUi({ barContainer: $('#app'), stageContainer: $('#stage-wrap'), mapContainer: $('#map') }, {
    toggleMic, toggleCam, toggleScreen, endCall, setStatus, logout,
    restartMic, applySpeaker, applyLowRes,
    profileChanged: () => { broadcastState(); map.updateAvatar(S.me.id); ui.renderBar(); },
    mapSaved: () => { S.local.zone = map.currentZoneId(); map.renderZones(); map.renderItems(); broadcastState(); refreshMedia(); emit('zone'); },
  });

  S.local.zone = map.currentZoneId();
  map.renderZones();
  map.renderAvatars();

  try {
    const h = await api('chat_history');
    chat.addMessages(h.messages, { silent: true });
    S.lastMsgId = Math.max(S.lastMsgId, h.lastId);
  } catch { /* a szinkron később pótolja */ }

  document.addEventListener('keydown', shortcuts);
  window.addEventListener('pagehide', leave);
  window.addEventListener('online', () => requestSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestSync(); updateTitle(); });
  on('unread', updateTitle);
  applyLowRes();
  sync();
}

function micErrorToast() {
  const e = media.local.micError;
  const text = e === 'NotAllowedError'
    ? 'A böngésző nem kapott engedélyt a mikrofonhoz. Engedélyezd a címsor bal oldalán lévő ikonnál (Macen a Rendszerbeállítások › Adatvédelem › Mikrofon menüben is), majd kattints a mikrofon gombra.'
    : e === 'NotFoundError' ? 'Nem található mikrofon.' : 'Nem sikerült elindítani a mikrofont (' + e + ').';
  toast(text, { type: 'error', timeout: 12000 });
}

// ======================================================================= szinkron a PHP-val

function publicState() {
  return {
    x: Math.round(S.local.x), y: Math.round(S.local.y), zone: S.local.zone, status: S.local.status,
    mic: S.local.mic, cam: S.local.cam, screen: S.local.screen, call: S.local.call,
    dir: S.local.dir || 'down', name: S.me.name, avatar: S.me.avatar,
  };
}

function nextDelay() {
  if (failures) return Math.min(15000, 1500 * failures);
  if (outbox.length) return 60;
  if (pm?.busy) return 800;
  return 3000;
}

function schedule(ms) {
  cancelSync?.();
  cancelSync = bgTimeout(sync, ms);
}

function requestSync() {
  if (stopped) return;
  if (syncing) syncAgain = true;
  else schedule(60);
}

async function sync() {
  if (stopped) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  cancelSync?.();
  const out = outbox.splice(0, 50);
  try {
    const res = await api('sync', {
      peer: S.peerId, claim: firstSync, state: publicState(),
      out: out.map(({ to, data }) => ({ to, data })), lastMsg: S.lastMsgId,
    });
    firstSync = false;
    if (res.kicked) return kicked();
    if (failures >= 3) toast('Újra kapcsolódva a szerverhez.', { type: 'ok' });
    failures = 0;
    applyUsers(res.users);
    for (const s of res.signals) {
      if (s.data?.type === 'poke') receivePoke(s.user);
      else pm.handleSignal(s.from, s.user, s.data);
    }
    if (res.messages.length) chat.addMessages(res.messages);
    if (res.mapVersion !== S.world.version && !map.isEditing()) reloadMap();
  } catch (e) {
    if (e.status === 401) { stopAll(); return showLogin(); }
    // a régi (>30 mp) jelzéseket eldobjuk, a többit újraküldjük
    outbox.unshift(...out.filter((o) => Date.now() - o.at < 30000));
    failures++;
    if (failures === 3) toast('Nem érem el a szervert, újrapróbálom…', { type: 'error', timeout: 6000 });
  } finally {
    syncing = false;
    if (!stopped) schedule(syncAgain ? 30 : nextDelay());
    syncAgain = false;
  }
}

const LIVE_FIELDS = ['x', 'y', 'zone', 'status', 'mic', 'cam', 'screen', 'call'];

function applyUsers(list) {
  let rosterChanged = false;
  const seen = new Set();
  for (const u of list) {
    if (u.id === S.me.id) continue;
    seen.add(u.id);
    if (u.peerId && gonePeers.has(u.peerId)) { u.online = false; u.peerId = null; }
    const old = S.users.get(u.id);
    if (!old) { S.users.set(u.id, u); rosterChanged = true; continue; }
    if (old.online !== u.online || old.peerId !== u.peerId) rosterChanged = true;
    // Ha él az adatcsatorna, az onnan jövő élő adat a pontosabb.
    const live = u.online && old.peerId === u.peerId && pm.isOpenTo(u.id);
    const next = { ...old, ...u };
    if (live) for (const f of LIVE_FIELDS) next[f] = old[f];
    S.users.set(u.id, next);
  }
  for (const id of [...S.users.keys()]) if (!seen.has(id)) { S.users.delete(id); rosterChanged = true; }
  if (rosterChanged) {
    pm.syncRoster([...S.users.values()].filter((u) => u.online));
    // A hívásban lévő partner eltűnt?
    if (S.local.call && !S.users.get(S.local.call)?.online) { S.local.call = null; broadcastState(); toast('A hívás véget ért (a partner kilépett).'); }
  }
  map.renderAvatars();
  emit('users');
  refreshMedia();
}

function reloadMap() {
  api('me').then((me) => {
    S.world = me.world;
    S.zones = me.zones;
    S.items = me.items || [];
    S.local.zone = map.currentZoneId();
    map.renderZones();
    map.renderItems();
    broadcastState();
    refreshMedia();
    emit('zone');
  }).catch(() => {});
}

function kicked() {
  stopAll();
  showFatal('Másik ablakban vagy gépen beléptél az irodába, ezért ez az ablak kilépett.', true);
  $('#fatal-retry').textContent = 'Belépés ebben az ablakban';
}

function stopAll() {
  stopped = true;
  cancelSync?.();
  pm?.closeAll();
  media.stopMic(); media.stopCam(); media.stopScreen();
  for (const id of [...remoteAudio.keys()]) removeRemoteMedia(id);
}

function leave() {
  if (stopped) return;
  pm?.broadcast({ t: 'bye' });
  try { navigator.sendBeacon('api/?a=leave', new Blob([JSON.stringify({ peer: S.peerId })], { type: 'text/plain' })); } catch { /* */ }
}

async function logout() {
  leave();
  stopAll();
  try { await api('logout', {}); } catch { /* */ }
  location.reload();
}

// ======================================================================= saját mozgás és állapot

let lastPosSent = 0;
let posTimer = null;

function onLocalMove(final = false) {
  const z = map.currentZoneId();
  if (z !== S.local.zone) {
    S.local.zone = z;
    map.renderZones();
    broadcastState();
    refreshMedia();
    emit('zone');
    return;
  }
  const now = performance.now();
  const send = () => {
    lastPosSent = performance.now();
    pm.broadcast({ t: 'pos', x: Math.round(S.local.x), y: Math.round(S.local.y), d: S.local.dir || 'down', mv: !final && !!S.local.moving });
  };
  clearTimeout(posTimer);
  if (final || now - lastPosSent > 80) send();
  else posTimer = setTimeout(send, 80);
}

function broadcastState() {
  pm?.broadcast({ t: 'state', ...publicState() });
  emit('local');
  requestSync();
}

function setStatus(s) {
  S.local.status = s;
  broadcastState();
  map.updateAvatar(S.me.id);
  refreshMedia();
}

async function toggleMic() {
  if (!media.local.micTrack) {
    await media.startMic();
    if (!media.local.micTrack) return micErrorToast();
    media.setMicMuted(false);
    S.local.mic = true;
    pm.refreshAll();
  } else {
    S.local.mic = !S.local.mic;
    media.setMicMuted(!S.local.mic);
  }
  map.updateAvatar(S.me.id);
  broadcastState();
}

async function restartMic() {
  await media.startMic();
  S.local.mic = !!media.local.micTrack && !media.prefs.micMuted;
  if (media.local.micError) micErrorToast();
  pm.refreshAll();
  map.updateAvatar(S.me.id);
  broadcastState();
}

async function toggleCam() {
  if (S.local.cam) { media.stopCam(); S.local.cam = false; }
  else {
    try { await media.startCam(); S.local.cam = true; }
    catch (e) { toast('Nem sikerült elindítani a kamerát (' + e.name + ').', { type: 'error' }); return; }
  }
  pm.refreshAll();
  broadcastState();
  refreshMedia();
}

async function toggleScreen() {
  if (S.local.screen) { media.stopScreen(); S.local.screen = false; }
  else {
    try {
      await media.startScreen(() => { S.local.screen = false; pm.refreshAll(); broadcastState(); refreshMedia(); });
      S.local.screen = true;
    } catch (e) {
      if (e.name !== 'NotAllowedError') toast('Nem sikerült a képernyőmegosztás (' + e.name + ').', { type: 'error' });
      else toast('Macen a Rendszerbeállítások › Adatvédelem › Képernyőfelvétel menüben engedélyezd a böngészőt.', { timeout: 8000 });
      return;
    }
  }
  pm.refreshAll();
  broadcastState();
  refreshMedia();
}

function shortcuts(e) {
  if (e.target.closest?.('input, textarea, select') || document.querySelector('.overlay') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMic(); }
  else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); chat.toggle(); }
}

// ======================================================================= adatcsatorna üzenetek

function onPeerData(peer, msg) {
  const u = S.users.get(peer.userId);
  switch (msg.t) {
    case 'state': {
      if (!u) return;
      const prevKey = [u.zone, u.status, u.call, u.cam, u.screen].join('|');
      for (const f of LIVE_FIELDS) if (f in msg) u[f] = msg[f];
      if (typeof msg.name === 'string') u.name = msg.name.slice(0, 40);
      if (msg.avatar && typeof msg.avatar === 'object') u.avatar = msg.avatar;
      if (DIRS.includes(msg.dir)) u.dir = msg.dir;
      map.updateAvatar(u.id);
      if (prevKey !== [u.zone, u.status, u.call, u.cam, u.screen].join('|')) refreshMedia();
      emit('users');
      // Ha a partner már nincs velünk hívásban, mi is lezárjuk.
      if (S.local.call === u.id && u.call !== S.me.id && callConfirmed) { S.local.call = null; callConfirmed = false; broadcastState(); refreshMedia(); toast(`${u.name} befejezte a hívást.`); }
      break;
    }
    case 'pos':
      if (!u) return;
      u.x = Number(msg.x) || 0;
      u.y = Number(msg.y) || 0;
      if (DIRS.includes(msg.d)) u.dir = msg.d;
      u.moving = !!msg.mv;
      // ha a "megálltam" üzenet elveszne, magától is leáll a lépésanimáció
      clearTimeout(u._walkT);
      if (u.moving) u._walkT = setTimeout(() => { u.moving = false; map.updateAvatar(u.id); }, 400);
      map.updateAvatar(u.id);
      break;
    case 'poke':
      receivePoke(peer.userId);
      break;
    case 'chat':
      if (msg.m && msg.m.senderId === peer.userId) chat.addMessages([msg.m]);
      break;
    case 'call':
      onCallMessage(peer.userId, msg.a);
      break;
    case 'bye':
      gonePeers.add(peer.peerId);
      if (u) { u.online = false; u.peerId = null; }
      pm.drop(peer.peerId);
      S.conn.delete(peer.userId);
      if (S.local.call === peer.userId) { S.local.call = null; broadcastState(); }
      map.renderAvatars();
      emit('users');
      refreshMedia();
      break;
  }
}

// ======================================================================= távoli hang és kép

function onRemoteTrack(peer, slot, track) {
  const userId = peer.userId;
  if (slot === 'audio') {
    removeRemoteAudio(userId);
    const audio = el('audio', { autoplay: true });
    audio.srcObject = new MediaStream([track]);
    $('#audio-sink').append(audio);
    if (media.prefs.speakerId && audio.setSinkId) audio.setSinkId(media.prefs.speakerId).catch(() => {});
    audio.play().catch(() => {});
    let meter = null;
    try { meter = new media.LevelMeter(audio.srcObject); } catch { /* */ }
    remoteAudio.set(userId, { audio, meter, track });
  } else {
    const v = remoteVideo.get(userId) || {};
    v[slot] = track;
    remoteVideo.set(userId, v);
  }
  refreshMedia();
}

function removeRemoteAudio(userId) {
  const r = remoteAudio.get(userId);
  if (!r) return;
  r.meter?.dispose();
  r.audio.srcObject = null;
  r.audio.remove();
  remoteAudio.delete(userId);
  map.setSpeaking(userId, false);
}

function removeRemoteMedia(userId) {
  removeRemoteAudio(userId);
  remoteVideo.delete(userId);
  ui.renderVideos(remoteVideo);
}

function applySpeaker() {
  for (const { audio } of remoteAudio.values()) {
    if (audio.setSinkId) audio.setSinkId(media.prefs.speakerId || '').catch(() => {});
  }
}

// Mindig a hallhatósági szabály szerint: amit nem szabad hallani, az némítva.
function refreshMedia() {
  if (!pm) return;
  pm.refreshAll();
  const me = meAsUser();
  for (const [userId, r] of remoteAudio) {
    r.audio.muted = !audible(me, S.users.get(userId));
  }
  ui.renderVideos(remoteVideo);
  ui.renderBar();
}

// Ki beszél éppen? (zöld keret az avataron)
const speakHold = new Map();
let localMeter = null;
let localMeterStream = null;

function speakingTick() {
  if (document.hidden) return;
  const now = performance.now();
  const mark = (id, lvl) => {
    if (lvl > 0.02) speakHold.set(id, now + 300);
    map.setSpeaking(id, (speakHold.get(id) || 0) > now);
  };
  if (media.local.micStream !== localMeterStream) {
    localMeter?.dispose();
    localMeter = null;
    localMeterStream = media.local.micStream;
    if (localMeterStream) { try { localMeter = new media.LevelMeter(localMeterStream); } catch { /* */ } }
  }
  mark(S.me.id, localMeter && S.local.mic ? localMeter.level() : 0);
  for (const [userId, r] of remoteAudio) mark(userId, r.meter && !r.audio.muted ? r.meter.level() : 0);
}

// ======================================================================= közvetlen hívás

let pendingCall = null; // { userId, close, timer }
let incomingCall = null;
let callConfirmed = false;

function startCall(userId) {
  const u = S.users.get(userId);
  if (!u) return;
  if (!pm.isOpenTo(userId)) return toast(`Nincs kapcsolat vele: ${u.name}.`, { type: 'error' });
  if (S.local.call) endCall();
  cancelPending();
  pm.sendToUser(userId, { t: 'call', a: 'req' });
  const close = toast(`${u.name} hívása…`, { timeout: 0, actions: [{ label: 'Mégse', onClick: () => { pm.sendToUser(userId, { t: 'call', a: 'cancel' }); pendingCall = null; } }] });
  pendingCall = { userId, close, timer: setTimeout(() => { if (pendingCall?.userId === userId) { pm.sendToUser(userId, { t: 'call', a: 'cancel' }); cancelPending(); toast(`${u.name} nem vette fel.`); } }, 30000) };
}

function cancelPending() {
  if (!pendingCall) return;
  clearTimeout(pendingCall.timer);
  pendingCall.close();
  pendingCall = null;
}

function beginCall(userId) {
  S.local.call = userId;
  callConfirmed = true;
  broadcastState();
  map.updateAvatar(S.me.id);
  refreshMedia();
}

function endCall() {
  const other = S.local.call;
  if (!other) return;
  S.local.call = null;
  callConfirmed = false;
  pm.sendToUser(other, { t: 'call', a: 'end' });
  broadcastState();
  map.updateAvatar(S.me.id);
  refreshMedia();
}

function onCallMessage(from, a) {
  const u = S.users.get(from);
  const name = u?.name || 'Valaki';
  if (a === 'req') {
    if (S.local.call || incomingCall) return pm.sendToUser(from, { t: 'call', a: 'busy' });
    ring();
    const close = toast(`${name} hív (csak ketten fogjátok hallani egymást).`, {
      timeout: 30000,
      actions: [
        { label: 'Elutasítom', onClick: () => { incomingCall = null; pm.sendToUser(from, { t: 'call', a: 'decline' }); } },
        { label: 'Felveszem', primary: true, onClick: () => { incomingCall = null; pm.sendToUser(from, { t: 'call', a: 'accept' }); beginCall(from); } },
      ],
    });
    incomingCall = { from, close };
    setTimeout(() => { if (incomingCall?.from === from) incomingCall = null; }, 30000);
    notify(`${name} hív`, 'Kattints az irodára a hívás fogadásához.');
  } else if (a === 'cancel') {
    if (incomingCall?.from === from) { incomingCall.close(); incomingCall = null; toast(`${name} visszavonta a hívást.`); }
  } else if (a === 'accept') {
    if (pendingCall?.userId === from) { cancelPending(); beginCall(from); }
  } else if (a === 'decline' || a === 'busy') {
    if (pendingCall?.userId === from) { cancelPending(); toast(a === 'busy' ? `${name} éppen hívásban van.` : `${name} most nem tudja fogadni a hívást.`); }
  } else if (a === 'end') {
    if (S.local.call === from) { S.local.call = null; callConfirmed = false; broadcastState(); map.updateAvatar(S.me.id); refreshMedia(); toast(`${name} befejezte a hívást.`); }
  }
}

// ======================================================================= értesítések

function beep(freq = 880, dur = 0.12, when = 0) {
  try {
    const c = media.audioContext();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + when);
    o.stop(c.currentTime + when + dur + 0.05);
  } catch { /* */ }
}

// ======================================================================= bökés

const DIRS = ['down', 'up', 'left', 'right'];
const pokeSent = new Map();
const pokeRecv = new Map();

function sendPoke(userId) {
  const u = S.users.get(userId);
  if (!u || !u.online) return toast('Csak online kollégát lehet megbökni.');
  const now = Date.now();
  if (now - (pokeSent.get(userId) || 0) < 3000) return;
  pokeSent.set(userId, now);
  // ha nincs közvetlen kapcsolat, a szerveren át megy
  if (!pm.sendToUser(userId, { t: 'poke' }) && u.peerId) {
    outbox.push({ to: u.peerId, data: { type: 'poke' }, at: now });
    requestSync();
  }
  map.shake(userId);
  toast(`👉 Megbökted: ${u.name}`, { timeout: 2000 });
}

function receivePoke(fromId) {
  const now = Date.now();
  if (now - (pokeRecv.get(fromId) || 0) < 2000) return;
  pokeRecv.set(fromId, now);
  const name = S.users.get(fromId)?.name || 'Valaki';
  beep(523, 0.09); beep(784, 0.09, 0.11); beep(1046, 0.14, 0.22);
  map.shake(S.me.id);
  toast(`👉 ${name} bökdös téged!`, {
    timeout: 8000,
    actions: [{ label: 'Visszabököm', onClick: () => sendPoke(fromId) }, { label: 'Üzenet', primary: true, onClick: () => chat.openConversation('d:' + fromId) }],
  });
  notify(`👉 ${name} bökdös`, 'Kattints ide az irodához.', true);
}

// ======================================================================= takarékos mód

let speakTimer = null;
function applyLowRes() {
  const low = !!media.prefs.lowRes;
  document.body.classList.toggle('low-res', low);
  clearInterval(speakTimer);
  speakTimer = setInterval(speakingTick, low ? 500 : 150);
}

function ring() { beep(660, 0.15); beep(880, 0.15, 0.2); }

function notify(title, body, always = false) {
  if ((!always && !document.hidden) || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'ng-' + title });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* */ }
}

function notifyIncoming(m, key) {
  const sender = S.users.get(m.senderId);
  if (m.scope === 'dm') {
    beep(990, 0.08);
    notify(`${sender?.name || '?'} üzenete`, m.body.slice(0, 140));
  } else if (m.scope === 'zone' && m.targetId === S.local.zone) {
    notify(`${sender?.name || '?'} · ${zoneById(m.targetId)?.name || ''}`, m.body.slice(0, 140));
  }
}

function updateTitle() {
  const n = chat.totalUnread();
  document.title = (n ? `(${n}) ` : '') + S.appName;
}

// Hibakereséshez a böngésző konzolából: __ng.S, __ng.pm
window.__ng = { S, media, get pm() { return pm; }, walkTo: (x, y) => map.walkTo({ x, y }) };

boot();
export { ICONS };
