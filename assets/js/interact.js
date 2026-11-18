// Tárgyak interakciói: menük, modális ablakok, ajtók, ételek-italok, játékok.

import { S, zoneAt, zoneById } from './store.js';
import { el, modal, toast, ICONS, timeLabel, esc } from './util.js';
import * as map from './map.js';
import { CATALOG, itemBox, seatsOf, plantStatus } from './furniture.js';
import { sfx, ambience } from './sfx.js';
import { windowScene, fireScene, aquariumScene, plantScene, PLANT_TEXT, breathScene } from './scenes.js';
import * as games from './games.js';
import { HOLD_EMOJI } from './map.js';

let A = {}; // az app segédfüggvényei
const doorKeys = new Set(loadKeys());

export function initInteract(h) {
  A = h;
  games.initGames({
    setAct: (a) => A.setAct(a),
    sendTo: (id, msg) => A.sendTo(id, msg),
    userName: (id) => S.users.get(id)?.name || 'Ellenfél',
    myName: () => S.me.name,
    broadcastNote: (f, inst) => A.broadcastZone({ t: 'note', f, inst }),
    announce: (text) => A.broadcastZone({ t: 'fx', kind: 'text', text }),
    renderScores,
  });
}

const st = (it) => S.itemStates[it.uid] || {};
const nameOf = (it) => (it.label && !CATALOG[it.type].hasLabel ? it.label : CATALOG[it.type].label);
let busyToken = 0;

// ---------------------------------------------------------------- ajtók

function loadKeys() {
  try { return JSON.parse(sessionStorage.getItem('ng_keys') || '[]'); } catch { return []; }
}
function saveKeys() {
  try { sessionStorage.setItem('ng_keys', JSON.stringify([...doorKeys])); } catch { /* */ }
}

/** Az ajtó az én szemszögemből: open | closed | locked | key */
export function doorAccess(it) {
  const s = st(it);
  if (s.locked) {
    if (doorKeys.has(it.uid + ':' + s.lockId)) return 'key';
    if (s.lockZone != null && S.local.zone === s.lockZone) return 'key'; // bentről bárki kimehet
    return 'locked';
  }
  return s.open ? 'open' : 'closed';
}

/** Ha nekimegyünk egy ajtónak: a csukottat kinyitjuk, a zártnál jelszót kérünk. */
export function onBump(it) {
  const a = doorAccess(it);
  if (a === 'closed') setDoor(it, true);
  else if (a === 'locked') askPassword(it);
}

async function setDoor(it, open) {
  // azonnal mutatjuk, a szerver utána erősít meg
  S.itemStates[it.uid] = { ...st(it), open };
  map.updateItem(it.uid);
  sfx.door();
  try { await A.itemOp(it.uid, 'door', { open }); } catch (e) { if (e.code === 'locked') toast('Az ajtó zárva van.'); }
}

let pwOpen = false;
function askPassword(it) {
  if (pwOpen) return;
  pwOpen = true;
  const s = st(it);
  const input = el('input', { type: 'password', placeholder: 'Jelszó', autocomplete: 'off' });
  const err = el('p', { class: 'err small' });
  const tryIt = async () => {
    try {
      const res = await A.itemOp(it.uid, 'unlock_check', { password: input.value }, { silent: true });
      doorKeys.add(it.uid + ':' + res.lockId);
      saveKeys();
      sfx.lock();
      map.rebuildNav();
      close();
      toast('🔑 Bejöhetsz!', { type: 'ok' });
    } catch (e) {
      err.textContent = e.code === 'wrong_password' ? 'Hibás jelszó.' : 'Hiba: ' + e.code;
      sfx.fail();
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryIt(); });
  const close = modal('🔒 Zárt ajtó', el('div', { class: 'form' },
    el('p', {}, `Ezt az ajtót ${s.lockedBy || 'valaki'} bezárta. A belépéshez jelszó kell.`),
    input, err,
    el('button', { class: 'btn primary', onclick: tryIt }, 'Belépés')), { onClose: () => { pwOpen = false; } });
  setTimeout(() => input.focus(), 50);
}

/** Az ajtó két oldalán lévő szobák. A zár a szobát védi: ha bentről zárják, azt a szobát,
 *  ha kívülről (pl. a folyosóról), akkor az ajtó túloldalán lévőt. */
function lockZoneFor(it) {
  const b = itemBox(it);
  const horiz = b.w >= b.h;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const sides = horiz ? [[cx, b.y - 20], [cx, b.y + b.h + 20]] : [[b.x - 20, cy], [b.x + b.w + 20, cy]];
  const zones = sides.map(([x, y]) => zoneAt(x, y)?.id ?? null);
  if (S.local.zone != null && zones.includes(S.local.zone)) return S.local.zone;
  return zones.find((z) => z != null) ?? S.local.zone;
}

function askLock(it) {
  const input = el('input', { type: 'text', placeholder: 'Jelszó a belépéshez', maxlength: 64, autocomplete: 'off' });
  const go = async () => {
    if (!input.value) return;
    try {
      const res = await A.itemOp(it.uid, 'lock', { password: input.value, zone: lockZoneFor(it) });
      doorKeys.add(it.uid + ':' + res.state.lockId);
      saveKeys();
      map.rebuildNav();
      sfx.lock();
      close();
      toast('🔒 Bezártad az ajtót. Aki kívülről jön, annak meg kell adnia a jelszót.', { type: 'ok', timeout: 6000 });
    } catch (e) { toast('Nem sikerült: ' + e.code, { type: 'error' }); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const close = modal('🔒 Ajtó bezárása', el('div', { class: 'form' },
    el('p', { class: 'muted-text' }, 'A szobában lévők szabadon kimehetnek. Aki kívülről jön, csak ezzel a jelszóval léphet be. Oszd meg chatben azokkal, akiket vársz.'),
    input, el('button', { class: 'btn primary', onclick: go }, 'Bezárom')));
  setTimeout(() => input.focus(), 50);
}

async function unlockDoor(it) {
  try {
    await A.itemOp(it.uid, 'unlock', { zone: S.local.zone }, { silent: true });
    sfx.lock();
    toast('🔓 Feloldottad a zárat.');
  } catch (e) {
    if (e.code === 'wrong_password') {
      const input = el('input', { type: 'password', placeholder: 'Jelszó' });
      const close = modal('🔓 Zár feloldása', el('div', { class: 'form' }, el('p', {}, 'Kívülről a zár feloldásához a jelszó kell.'), input,
        el('button', { class: 'btn primary', onclick: async () => { try { await A.itemOp(it.uid, 'unlock', { password: input.value }); close(); sfx.lock(); } catch { toast('Hibás jelszó.', { type: 'error' }); } } }, 'Feloldás')));
    } else toast('Hiba: ' + e.code, { type: 'error' });
  }
}

// ---------------------------------------------------------------- menü

/** Kattintás vagy X egy tárgyon: odasétál, majd megnyitja a menüt. */
export function openItem(it) {
  map.walkToItem(it, () => openMenu(it));
}

function openMenu(it) {
  const def = CATALOG[it.type];
  const entries = [];
  if (it.url) entries.push({ icon: '🔗', label: 'Link megnyitása', run: () => openUrl(it.url, nameOf(it)), primary: true });
  for (const a of def.actions || []) {
    const fn = ACTIONS[a];
    if (fn) entries.push(...fn(it, st(it)).filter(Boolean));
  }
  if (!entries.length) return;
  const status = statusLine(it);
  const box = el('div', { class: 'popover card item-menu', onmousedown: (e) => e.stopPropagation() },
    el('div', { class: 'pop-head' }, el('strong', {}, nameOf(it)), status ? el('span', { class: 'muted-text' }, status) : null),
    entries.map((e) => el('button', { class: `btn block ${e.primary ? 'primary' : ''}`, onclick: () => { map.closePopover(); e.run(); } }, el('span', { class: 'emoji-ico' }, e.icon), el('span', {}, e.label))));
  const b = itemBox(it);
  map.openBoxAt(box, b.x + b.w + 6, b.y - 10);
}

function statusLine(it) {
  const s = st(it);
  const def = CATALOG[it.type];
  if (def.door) return s.locked ? `🔒 Zárva (${s.lockedBy || '?'})` : s.open ? 'Nyitva' : 'Csukva';
  if ((def.actions || []).includes('waterplant')) return PLANT_TEXT[plantStatus(s).status].title;
  if ((def.actions || []).includes('feedpet') || it.type === 'aquarium') return hungerText(it, s);
  if (it.type === 'pizza_box') return `${Math.max(0, 8 - (s.taken || 0))} szelet maradt`;
  if (it.type === 'trophy' && s.holder) return `🏆 ${s.holder}`;
  if (it.type === 'disco_ball' || it.type === 'neon_sign' || it.type.includes('lamp')) return s.on ? 'Bekapcsolva' : 'Kikapcsolva';
  return '';
}

function hungerText(it, s) {
  if (!s.fedAt) return 'Éhes lehet…';
  const h = (Date.now() / 1000 - s.fedAt) / 3600;
  const limit = it.type === 'aquarium' ? 24 : 8;
  return h < limit ? `Jóllakott (${s.fedBy || '?'} etette)` : h < limit * 3 ? 'Kezd éhes lenni' : 'Nagyon éhes!';
}

// ---------------------------------------------------------------- közös segédek

/** Egy időbe telő tevékenység (pl. kávéfőzés). Ha közben elmegyünk, megszakad. */
function process(act, ms, done, sound) {
  const token = ++busyToken;
  A.setAct(act);
  sound?.();
  setTimeout(() => {
    if (token !== busyToken || S.local.act !== act) return;
    A.setAct(null);
    done?.();
  }, ms);
}
export function cancelBusy() { busyToken++; }

function giveHold(item, text) {
  if (S.local.hold && S.local.hold !== item) toast(`Letetted: ${HOLD_EMOJI[S.local.hold] || ''}`);
  A.setHold(item);
  if (text) toast(text, { timeout: 2500 });
}

function choose(title, options, onPick) {
  const close = modal(title, el('div', { class: 'choice-grid' }, options.map((o) => el('button', { class: 'choice', onclick: () => { close(); onPick(o); } },
    el('span', { class: 'choice-ico' }, o.icon), el('span', {}, o.label)))));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function sitOn(it) {
  const seats = seatsOf(it).filter((s) => !map.seatTaken(it, s));
  if (!seats.length) return toast('Nincs szabad hely.');
  seats.sort((a, b) => Math.hypot(a.x - S.local.x, a.y - S.local.y) - Math.hypot(b.x - S.local.x, b.y - S.local.y));
  map.placeOnSeat(seats[0], it);
  A.broadcastState();
}

function standOn(it, act) {
  const b = itemBox(it);
  map.placeOnSeat({ x: b.x + b.w / 2, y: b.y + b.h / 2, dir: 'down', pose: 'on' }, it);
  A.setAct(act);
  A.broadcastState();
}

// ---------------------------------------------------------------- szövegek a hangulathoz

const MEMOS = [
  'FONTOS: A hűtőben lévő joghurt NEM közös. – Valaki, akinek hiányzik egy joghurt',
  'Pénteken 4-kor csapatépítő: pizza és pingpong bajnokság 🏓',
  'Kérjük, aki az utolsó kávét lefőzi, töltse fel a vizet. Köszönjük! ☕',
  'Q3 jelentés: minden zöld. Kivéve a növényeket, azokat valaki locsolja meg.',
  'Emlékeztető: a nyomtató nem ellenség. Csak néha.',
];
const DOCS = ['Szerződés_végleges_v7_TÉNYLEG_végleges.pdf', 'Leltár 2019 (senki nem tudja, miért van még itt)', 'Egy régi karácsonyi parti fotói 🎄', 'Kitöltetlen szabadságigénylő (ideje lenne beadni)', 'Kávéfogyasztási statisztika: 4,2 csésze/fő/nap', 'Egy titkos recept: nagymama pogácsája'];
const BOOKS = [
  ['Gyalog galopp a projektmenedzsmentben', 'D. Line', 'Minden határidő közelebb van, mint amilyennek látszik.'],
  ['A csendes óra', 'F. Ókusz', 'A legjobb ötletek a második kávé után jönnek.'],
  ['Kód és kávé', 'J. S. Bean', 'Működik a gépemen – és most már a tiéden is.'],
  ['Az iroda növényei', 'Z. Öld', 'Egy pohár víz többet ér ezer bocsánatkérésnél.'],
  ['Csapatban erősebbek', 'T. Eam', 'Egyedül gyorsabb, együtt messzebbre jutunk.'],
];
const FACTS = ['🇮🇸 Izlandon nincsenek szúnyogok.', '🇯🇵 Japánban több mint 5 millió automata működik.', '🇭🇺 A Rubik-kockát egy magyar, Rubik Ernő találta fel 1974-ben.', '🇦🇺 Ausztráliában több a kenguru, mint az ember.', '🇫🇷 Franciaországban 12 időzóna van – a tengerentúli területek miatt.', '🇳🇿 Új-Zélandon több a juh, mint az ember: kb. 5 juh jut egy lakosra.', '🇨🇦 Kanadában van a világ legtöbb tava.'];
const FORTUNES = ['✨ Ma minden meeting rövidebb lesz a vártnál.', '🍀 Hamarosan egy jó hír érkezik e-mailben.', '☕ A következő kávéd lesz az eddigi legfinomabb.', '🌈 Egy régóta húzódó feladat ma magától megoldódik.', '🎉 Valaki ma megdicsér. Fogadd el!'];
const ELEVATOR = ['🛗 Ding! …a lift megérkezett, de üres. Lépcső?', '🛗 A lift karbantartás alatt. Mozgás egészséges! 🏃', '🛗 Ding! A lift a 42. emeletre megy. Mi csak 1 emeletesek vagyunk…'];

// ---------------------------------------------------------------- az interakciók

const ACTIONS = {
  sit: (it) => [{ icon: '🪑', label: 'Leülök', run: () => sitOn(it), primary: !it.url }],
  lie: (it) => [{ icon: '😴', label: 'Lefekszem pihenni', run: () => { sitOn(it); A.setAct('chill'); } }],

  door: (it, s) => {
    const a = doorAccess(it);
    const out = [];
    if (!s.locked) out.push(s.open ? { icon: '🚪', label: 'Becsukom', run: () => setDoor(it, false) } : { icon: '🚪', label: 'Kinyitom', run: () => setDoor(it, true), primary: true });
    if (!s.locked) out.push({ icon: '🔒', label: 'Bezárom jelszóval', run: () => askLock(it) });
    if (s.locked && a === 'locked') out.push({ icon: '🔑', label: 'Jelszó megadása', run: () => askPassword(it), primary: true });
    if (s.locked) out.push({ icon: '🔓', label: 'Zár feloldása', run: () => unlockDoor(it) });
    return out;
  },

  window: (it) => [{ icon: '🌄', label: 'Kinézek az ablakon (chill)', run: () => openWindow(it), primary: true }],

  type: (it) => [{ icon: '⌨️', label: 'Gépelek (közös jegyzet)', run: () => openNotes(it), primary: true }],
  read: () => [{ icon: '📄', label: 'Átolvasom', run: () => { A.setAct('read'); modal('📄 Feljegyzés', el('div', { class: 'memo' }, pick(MEMOS)), { onClose: () => A.setAct(null) }); } }],
  takemug: () => [{ icon: '😋', label: 'Kortyolok egyet', run: () => process('drink', 2200, () => A.emote('😋')) }],
  drawer: () => [{ icon: '🗄️', label: 'Kihúzom a fiókot', run: () => { sfx.click(); modal('🗄️ A fiókban…', el('ul', { class: 'doc-list' }, DOCS.sort(() => Math.random() - 0.5).slice(0, 3).map((d) => el('li', {}, '📁 ' + d)))); } }],
  book: () => [{ icon: '📚', label: 'Leveszek egy könyvet', run: () => openBook() }],
  print: () => [{ icon: '🖨️', label: 'Nyomtatok', run: () => process('print', 2600, () => giveHold('paper', '📄 Kész a nyomtatás.'), sfx.print) }],
  shred: () => [S.local.hold === 'paper'
    ? { icon: '✂️', label: 'Megsemmisítem a papírt', run: () => { sfx.shred(); A.setHold(null); } }
    : { icon: '✂️', label: 'Nincs nálad papír (a nyomtatónál kaphatsz)', run: () => {} }],
  draw: (it) => [{ icon: '✏️', label: 'Rajzolok a táblára', run: () => openWhiteboard(it), primary: true }],
  notes_board: (it) => [{ icon: '📌', label: 'Cetlik megnézése / felragasztása', run: () => openCork(it), primary: true }],
  calendar: () => [{ icon: '📅', label: 'Megnézem a naptárt', run: openCalendar }],
  clock: () => [{ icon: '🕰️', label: 'Hány óra van?', run: openClock }],
  server: () => [{ icon: '🖥️', label: 'Szerverek állapota', run: openServer }],
  present: (it) => [{ icon: '📽️', label: 'Vetítés', run: () => (it.url ? openUrl(it.url, nameOf(it)) : hintNoUrl('vetítővászonhoz')) }],
  watch: (it) => [{ icon: '📺', label: 'Bekapcsolom', run: () => (it.url ? openUrl(it.url, nameOf(it)) : hintNoUrl('TV-hez')) }],
  radio: (it) => [{ icon: '📻', label: 'Bekapcsolom', run: () => (it.url ? openUrl(it.url, nameOf(it)) : hintNoUrl('rádióhoz (pl. egy online rádió oldala)')) }],
  globe: () => [{ icon: '🌍', label: 'Megpörgetem', run: () => { sfx.click(); toast(pick(FACTS), { timeout: 7000 }); } }],
  trophy: (it, s) => [
    { icon: '🏆', label: 'Megnézem', run: () => modal('🏆 A hónap kollégája', el('div', { class: 'trophy-view' }, el('div', { class: 'big-emoji' }, '🏆'), el('h3', {}, s.holder || 'Még senki'), s.holderBy ? el('p', { class: 'muted-text' }, `${s.holderBy} adta át`) : null)) },
    { icon: '🎖️', label: 'Átadom valakinek', run: () => chooseUser('Kinek adod a trófeát?', (u) => A.itemOp(it.uid, 'set', { patch: { holder: u.name, holderBy: S.me.name } }).then(() => A.broadcastAll({ t: 'fx', kind: 'text', text: `🏆 ${S.me.name} átadta a trófeát: ${u.name}!` }))) },
  ],
  coat: (it, s) => {
    const mine = (s.coats || []).find((c) => c.byId === S.me.id);
    return [mine
      ? { icon: '🧥', label: 'Leveszem a kabátom (megjöttem)', run: () => { A.itemOp(it.uid, 'list_remove', { key: 'coats', id: mine.id }); A.setStatus('available'); } }
      : { icon: '🧥', label: 'Felakasztom a kabátom (távol leszek)', run: () => { A.itemOp(it.uid, 'list_add', { key: 'coats', value: { color: S.me.avatar?.shirt || '#64748b' }, max: 12 }); A.setStatus('away'); } }];
  },
  ideas: (it) => [{ icon: '💡', label: 'Ötletláda', run: () => openIdeas(it), primary: true }],
  phone: () => [{ icon: '📞', label: 'Felhívok valakit', run: () => chooseUser('Kit hívsz?', (u) => A.startCall(u.id)) }],
  toggle: (it, s) => [{ icon: '💡', label: s.on ? 'Lekapcsolom' : 'Felkapcsolom', run: () => { sfx.click(); A.itemOp(it.uid, 'set', { patch: { on: !s.on } }); } }],
  standdesk: (it, s) => [{ icon: s.up ? '⬇️' : '⬆️', label: s.up ? 'Leengedem' : 'Felemelem (állva dolgozom)', run: () => { sfx.click(); A.itemOp(it.uid, 'set', { patch: { up: !s.up } }); } }],

  fireplace: () => [{ icon: '🔥', label: 'Melegedek a tűznél', run: openFire, primary: true }],
  aquarium: (it, s) => [
    { icon: '🐠', label: 'Nézem a halakat', run: () => openAquarium(it), primary: true },
    { icon: '🍤', label: 'Megetetem a halakat', run: () => feed(it, '🐟') },
  ],
  pet: (it) => [{ icon: '🤗', label: 'Megsimogatom', run: () => { process('pet', 1800); (it.type === 'cat' ? sfx.purr : sfx.bark)(); fx(it, '💕', 4); A.broadcastZone({ t: 'fx', kind: 'pet', uid: it.uid }); } }],
  feedpet: (it) => [{ icon: '🍖', label: 'Megetetem', run: () => feed(it, it.type === 'cat' ? '🐟' : '🦴') }],
  yoga: (it) => [{ icon: '🧘', label: 'Jógázom (légzőgyakorlat)', run: () => { standOn(it, 'yoga'); openBreath(); } }],
  run: (it) => [{ icon: '🏃', label: 'Futok egy kicsit', run: () => { standOn(it, 'run'); toast('🏃 Futsz! Mozdulj el, ha végeztél.'); } }],

  pong: (it, s) => pongEntries(it, s),
  arcade: (it) => [{ icon: '🕹️', label: 'Snake', run: () => games.openSnake(it, (sc) => saveScore(it, sc)), primary: true }],
  darts: (it) => [{ icon: '🎯', label: 'Darts', run: () => games.openDarts(it, (sc) => saveScore(it, sc)), primary: true }],
  piano: () => [{ icon: '🎹', label: 'Zongorázom', run: () => games.openPiano(), primary: true }],
  guitar: () => [{ icon: '🎸', label: 'Gitározom', run: () => games.openGuitar(), primary: true }],
  party: (it, s) => [{ icon: '🪩', label: s.on ? 'Buli vége' : 'Indul a buli!', run: async () => { await A.itemOp(it.uid, 'set', { patch: { on: !s.on } }); if (!s.on) { A.broadcastZone({ t: 'fx', kind: 'party', uid: it.uid }); partyToast(); A.setAct('dance'); } } }],
  dance: () => [{ icon: '💃', label: 'Táncolok', run: () => A.setAct('dance', true), primary: true }],
  pop: (it, s) => [s.popped
    ? { icon: '🎈', label: 'Új lufit fújok', run: () => A.itemOp(it.uid, 'set', { patch: { popped: false } }) }
    : { icon: '💥', label: 'Kidurrantom', run: () => { sfx.pop(); A.itemOp(it.uid, 'set', { patch: { popped: true } }); A.broadcastZone({ t: 'fx', kind: 'pop', uid: it.uid }); } }],
  gong: (it) => [{ icon: '🔔', label: 'Megkongatom (mindenki hallja!)', run: () => { sfx.gong(); fx(it, '🎉', 3); A.broadcastAll({ t: 'fx', kind: 'gong', uid: it.uid, text: `🔔 ${S.me.name} megkongatta a gongot!` }); } }],
  cake: (it, s) => [
    !s.blown ? { icon: '🕯️', label: 'Elfújom a gyertyákat', run: () => { A.itemOp(it.uid, 'set', { patch: { blown: true } }); confettiAt(it); A.broadcastZone({ t: 'fx', kind: 'confetti', uid: it.uid }); sfx.chime(); } }
      : { icon: '🕯️', label: 'Új gyertyák', run: () => A.itemOp(it.uid, 'set', { patch: { blown: false } }) },
    { icon: '🍰', label: 'Kérek egy szeletet', run: () => giveHold('cake', '🍰 Jó étvágyat!') },
  ],
  confetti: (it) => [{ icon: '🎉', label: 'Tűz!', run: () => { sfx.pop(); confettiAt(it); A.broadcastZone({ t: 'fx', kind: 'confetti', uid: it.uid }); } }],

  coffee: () => [{ icon: '☕', label: 'Kávét főzök', run: () => choose('☕ Milyen kávét?', [{ icon: '☕', label: 'Espresso' }, { icon: '🥛', label: 'Cappuccino' }, { icon: '🧋', label: 'Latte' }, { icon: '🫖', label: 'Hosszú kávé' }], (o) => process('brew', 4000, () => giveHold('coffee', `☕ Kész a ${o.label.toLowerCase()}! Megihatod, vagy odaadhatod valakinek.`), sfx.brew)), primary: true }],
  tea: () => [{ icon: '🍵', label: 'Teát főzök', run: () => process('brew', 3500, () => giveHold('tea', '🍵 Kész a tea.'), sfx.brew) }],
  toast: () => [{ icon: '🍞', label: 'Pirítóst csinálok', run: () => process('cook', 3000, () => { sfx.toast(); giveHold('toast', '🍞 Ropogós!'); }) }],
  popcorn: () => [{ icon: '🍿', label: 'Popcornt pattogtatok', run: () => process('cook', 3300, () => giveHold('popcorn', '🍿 Kész a popcorn!'), sfx.microwave) }],
  water: () => [{ icon: '🥤', label: 'Vizet engedek', run: () => process('water', 1500, () => giveHold('water'), sfx.pour) }],
  fridge: () => [{ icon: '🧊', label: 'Kinyitom a hűtőt', run: () => choose('🧊 A hűtőben', [{ icon: '🥤', label: 'Üdítő', id: 'soda' }, { icon: '🧃', label: 'Gyümölcslé', id: 'juice' }, { icon: '🍦', label: 'Jégkrém', id: 'icecream' }], (o) => { sfx.click(); giveHold(o.id); }) }],
  vending: () => [{ icon: '🪙', label: 'Veszek valamit', run: () => choose('🪙 Automata', [{ icon: '🍫', label: 'Csoki', id: 'chocolate' }, { icon: '🥨', label: 'Sós perec', id: 'chips' }, { icon: '🥤', label: 'Üdítő', id: 'soda' }], (o) => { sfx.coin(); giveHold(o.id); }) }],
  fruit: () => [{ icon: '🍎', label: 'Veszek egy gyümölcsöt', run: () => choose('🍎 Gyümölcstál', [{ icon: '🍎', label: 'Alma', id: 'apple' }, { icon: '🍌', label: 'Banán', id: 'banana' }], (o) => giveHold(o.id)) }],
  cookie: () => [{ icon: '🍪', label: 'Veszek egy kekszet', run: () => { sfx.click(); giveHold('cookie'); } }],
  pizza: (it, s) => [(s.taken || 0) < 8
    ? { icon: '🍕', label: 'Kérek egy szeletet', run: () => { A.itemOp(it.uid, 'set', { patch: { taken: (s.taken || 0) + 1 } }); giveHold('pizza', '🍕 Jó étvágyat!'); } }
    : { icon: '📞', label: 'Elfogyott – rendelek újat', run: () => { toast('🛵 Úton a pizza…'); setTimeout(() => A.itemOp(it.uid, 'set', { patch: { taken: 0 } }), 5000); } }],
  wash: () => [{ icon: '🫧', label: S.local.hold === 'mug' ? 'Elmosom a bögrét' : 'Kezet mosok', run: () => process('wash', 2500, () => { if (S.local.hold === 'mug') A.setHold(null); A.emote('✨'); }, sfx.splash) }],
  grill: () => [{ icon: '🌭', label: 'Sütök egy kolbászt', run: () => process('cook', 4000, () => giveHold('sausage', '🌭 Kész a kolbász!'), sfx.sizzle) }],
  wish: (it) => [{ icon: '🪙', label: 'Pénzt dobok és kívánok', run: () => { sfx.coin(); fx(it, '✨', 3); setTimeout(() => toast(pick(FORTUNES), { timeout: 7000 }), 700); } }],
  waterplant: (it, s) => [
    { icon: '💧', label: 'Megöntözöm', run: () => waterPlant(it), primary: plantStatus(s).status !== 'good' && plantStatus(s).status !== 'over' },
    { icon: '🔍', label: 'Hogy van a növény?', run: () => openPlant(it) },
  ],
  picture: (it) => [{ icon: '🖼️', label: 'Megnézem közelebbről', run: () => (it.url ? openUrl(it.url, nameOf(it)) : modal('🖼️ Kép', el('div', { class: 'scene', html: windowScene(7) }), { xl: true, fullscreen: true })) }],
  mirror: () => [{ icon: '🪞', label: 'Belenézek (avatar módosítása)', run: () => A.openProfile() }],
  trash: () => [S.local.hold
    ? { icon: '🗑️', label: `Kidobom: ${HOLD_EMOJI[S.local.hold] || ''}`, run: () => { sfx.click(); A.setHold(null); } }
    : { icon: '🗑️', label: 'Üres a kezed', run: () => {} }],
  radiator: () => [{ icon: '♨️', label: 'Megmelegszem', run: () => process('chill', 2500, () => toast('♨️ Átmelegedtél.')) }],
  elevator: () => [{ icon: '🛗', label: 'Hívom a liftet', run: () => { sfx.ding(); setTimeout(() => toast(pick(ELEVATOR)), 600); } }],
};

// ---------------------------------------------------------------- effektek

function fx(it, emoji, n = 1) { map.itemEffect(it.uid, emoji, n); }
function confettiAt(it) { const b = itemBox(it); map.confetti(b.x + b.w / 2, b.y + b.h / 2); }
function partyToast() { toast('🪩 Buli van! Táncolj: E → 💃', { timeout: 6000 }); }

/** Más felhasználótól érkező effekt. */
export function onFx(from, msg) {
  const it = msg.uid ? S.items.find((i) => i.uid === msg.uid) : null;
  const sameZone = it ? zoneAt(it.x + it.w / 2, it.y + it.h / 2)?.id === S.local.zone : true;
  switch (msg.kind) {
    case 'gong': sfx.gong(); if (it) fx(it, '🎉', 3); toast(msg.text || '🔔 Gong!'); break;
    case 'confetti': if (it) confettiAt(it); if (sameZone) sfx.pop(); break;
    case 'pop': if (sameZone) sfx.pop(); break;
    case 'pet': if (it) fx(it, '💕', 3); if (sameZone && it) (it.type === 'cat' ? sfx.purr : sfx.bark)(); break;
    case 'water': if (it) fx(it, '💧', 3); break;
    case 'party': if (sameZone) partyToast(); break;
    case 'text': toast(String(msg.text || '').slice(0, 200)); break;
  }
}

async function feed(it, emoji) {
  try {
    const res = await A.itemOp(it.uid, 'feed', {});
    if (res.alreadyFed) toast('Már jóllakott, most nem kér többet. 😊');
    else { fx(it, emoji, 3); toast('Megetetted! 😋'); }
  } catch (e) { toast('Hiba: ' + e.code, { type: 'error' }); }
}

async function waterPlant(it) {
  const before = plantStatus(st(it)).status;
  process('water', 1600, null, sfx.pour);
  fx(it, '💧', 4);
  A.broadcastZone({ t: 'fx', kind: 'water', uid: it.uid });
  try {
    const res = await A.itemOp(it.uid, 'water', {});
    const after = plantStatus(res.state).status;
    toast(after === 'over' ? '💦 Hoppá, ez már túl sok víz! Pár napig ne locsold.' : before === 'dying' ? '🌱 Megmentetted! Hamarosan magához tér.' : '💧 Megöntözted. Köszöni!', { timeout: 5000 });
  } catch (e) { toast('Hiba: ' + e.code, { type: 'error' }); }
}

// ---------------------------------------------------------------- modális ablakok

function hintNoUrl(what) {
  modal('🔗 Nincs beállítva link', el('div', { class: 'form' }, el('p', {}, `Ehhez a ${what} még nincs link rendelve.`),
    el('p', { class: 'muted-text' }, 'Akinek van térképszerkesztési joga, a szerkesztőben a tárgyat kijelölve megadhat egy linket (pl. YouTube videó, prezentáció, online rádió).')));
}

/** Link megnyitása beágyazva, teljes képernyővel és új lapon megnyitással. */
export function openUrl(url, title = 'Link') {
  let src = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) src = `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) src = `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  const frame = el('iframe', { src, class: 'url-frame', allow: 'autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture', allowfullscreen: true, referrerpolicy: 'no-referrer-when-downgrade' });
  const ext = el('a', { class: 'icon-btn', href: url, target: '_blank', rel: 'noopener noreferrer', title: 'Megnyitás új lapon', html: ICONS.external });
  modal('🔗 ' + title, el('div', { class: 'url-wrap' }, frame,
    el('p', { class: 'muted-text small' }, 'Ha üres marad, az oldal nem engedi a beágyazást – nyisd meg új lapon a ↗ gombbal.')),
  { xl: true, fullscreen: true, head: [ext] });
}

function openWindow(it) {
  A.setAct('chill');
  const amb = ambience({ birds: true, wind: true });
  const scene = el('div', { class: 'scene', html: windowScene(hashUid(it.uid)) });
  const rain = el('input', { type: 'checkbox' });
  rain.addEventListener('change', () => { amb.setRain(rain.checked); scene.classList.toggle('raining', rain.checked); });
  const vol = el('input', { type: 'range', min: 0, max: 100, value: 80 });
  vol.addEventListener('input', () => amb.setVolume(vol.value / 100));
  modal('🌄 Kilátás az ablakból', el('div', {}, scene,
    el('div', { class: 'scene-tools' }, el('label', { class: 'check' }, rain, '🌧️ Eső'), el('label', { class: 'inline' }, '🔊', vol), el('span', { class: 'muted-text small' }, 'Madárcsicsergés, szellő. Csak te hallod.'))),
  { xl: true, fullscreen: true, onClose: () => { amb.stop(); A.setAct(null); } });
}

function openFire() {
  A.setAct('chill');
  const amb = ambience({ birds: false, wind: false, fire: true });
  modal('🔥 Kandalló', el('div', { class: 'scene', html: fireScene() }), { xl: true, fullscreen: true, onClose: () => { amb.stop(); A.setAct(null); } });
}

function openAquarium(it) {
  const s = st(it);
  const hungry = !s.fedAt || Date.now() / 1000 - s.fedAt > 86400;
  const amb = ambience({ birds: false, wind: true });
  amb.setVolume(0.3);
  modal('🐠 Akvárium', el('div', {}, el('div', { class: 'scene', html: aquariumScene(hungry) }),
    el('div', { class: 'scene-tools' }, el('span', {}, hungerText(it, s)), el('button', { class: 'btn small', onclick: () => feed(it, '🐟') }, '🍤 Etetés'))),
  { xl: true, fullscreen: true, onClose: () => amb.stop() });
}

function openPlant(it) {
  const render = () => {
    const s = st(it);
    const { status } = plantStatus(s);
    box.innerHTML = '';
    box.append(el('div', { class: 'scene plant', html: plantScene(s, it.type) }),
      el('h3', {}, PLANT_TEXT[status].title), el('p', {}, PLANT_TEXT[status].text),
      s.wateredAt ? el('p', { class: 'muted-text small' }, `Utoljára ${s.wateredBy || '?'} locsolta: ${timeLabel(s.wateredAt)}`) : el('p', { class: 'muted-text small' }, 'Még senki nem locsolta.'),
      el('button', { class: 'btn primary', onclick: async () => { await waterPlant(it); render(); } }, '💧 Megöntözöm'));
  };
  const box = el('div', { class: 'form' });
  render();
  modal('🌿 ' + nameOf(it), box, { wide: true });
}

function openBreath() {
  const box = el('div', { html: breathScene() });
  const txt = () => box.querySelector('.breath-text');
  const phases = [['Belégzés…', 4000], ['Tartsd bent…', 4000], ['Kilégzés…', 6000]];
  let i = 0, t;
  const next = () => { const [w, ms] = phases[i % 3]; txt().textContent = w; box.firstChild.dataset.phase = i % 3; i++; t = setTimeout(next, ms); };
  next();
  modal('🧘 Légzőgyakorlat', box, { wide: true, onClose: () => { clearTimeout(t); A.setAct(null); } });
}

function openBook() {
  const [title, author, quote] = pick(BOOKS);
  A.setAct('read');
  const close = modal('📚 ' + title, el('div', { class: 'book' }, el('div', { class: 'book-cover' }, el('strong', {}, title), el('span', {}, author)),
    el('blockquote', {}, '„' + quote + '”'),
    el('button', { class: 'btn', onclick: () => { giveHold('book', '📘 Magaddal vitted a könyvet.'); close(); } }, '📘 Elviszem olvasni')), { wide: true, onClose: () => A.setAct(null) });
}

function openCalendar() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const week = Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
  const grid = el('div', { class: 'cal' }, ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((n) => el('b', {}, n)),
    Array.from({ length: offset }, () => el('span', {})), Array.from({ length: days }, (_, i) => el('span', { class: i + 1 === d.getDate() ? 'today' : '' }, i + 1)));
  modal('📅 ' + d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }), el('div', {},
    el('p', {}, `Ma ${d.toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' })} van, az év ${week}. hete.`), grid));
}

function openClock() {
  const face = el('div', { class: 'big-clock' });
  const zones = [['Budapest', 'Europe/Budapest'], ['London', 'Europe/London'], ['New York', 'America/New_York'], ['Tokió', 'Asia/Tokyo']];
  const list = el('div', { class: 'world-clocks' });
  const tick = () => {
    const d = new Date();
    face.textContent = d.toLocaleTimeString('hu-HU');
    list.innerHTML = '';
    for (const [n, tz] of zones) list.append(el('div', {}, el('strong', {}, n), ' ', d.toLocaleTimeString('hu-HU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })));
  };
  tick();
  const iv = setInterval(tick, 1000);
  modal('🕰️ Óra', el('div', {}, face, list), { onClose: () => clearInterval(iv) });
}

function openServer() {
  const bar = el('div', { class: 'meter big' }, el('div', { class: 'meter-fill' }));
  const log = el('pre', { class: 'server-log' }, `uptime: ${Math.floor(Math.random() * 300 + 20)} nap\nCPU: ${Math.floor(Math.random() * 40 + 10)}%  RAM: ${Math.floor(Math.random() * 50 + 30)}%\nállapot: minden rendben ✅`);
  modal('🖥️ Szerverterem', el('div', { class: 'form' }, log, bar,
    el('button', {
      class: 'btn', onclick: () => {
        let p = 0;
        const iv = setInterval(() => {
          p += 7; bar.firstChild.style.width = Math.min(100, p) + '%';
          if (p >= 100) { clearInterval(iv); log.textContent += '\nújraindítás kész. Kipróbáltad már ki- és bekapcsolni? 😄'; sfx.ok(); }
        }, 120);
      },
    }, '🔄 Újraindítás')));
}

// Közös jegyzet a laptopon
function openNotes(it) {
  A.setAct('type');
  const ta = el('textarea', { class: 'notes', rows: 14, placeholder: 'Írj ide valamit… (a gépet használó kollégák is látják)' });
  ta.value = st(it).text || '';
  const info = el('p', { class: 'muted-text small' }, st(it).textBy ? `Utoljára ${st(it).textBy} írta` : 'Közös jegyzet ezen a gépen.');
  let t = null, lastType = 0;
  ta.addEventListener('input', () => {
    if (performance.now() - lastType > 120) { sfx.type(); lastType = performance.now(); }
    clearTimeout(t);
    t = setTimeout(async () => {
      try { await A.itemOp(it.uid, 'set', { patch: { text: ta.value.slice(0, 20000), textBy: S.me.name } }); info.textContent = 'Mentve ✓'; } catch { info.textContent = 'Nem sikerült menteni.'; }
    }, 800);
  });
  modal('⌨️ ' + nameOf(it), el('div', { class: 'form' }, ta, info), { wide: true, onClose: () => { A.setAct(null); } });
  setTimeout(() => ta.focus(), 50);
}

// Tábla: közös rajz
let wbOpen = null;
function openWhiteboard(it) {
  const W = 900, Hh = 500;
  const canvas = el('canvas', { width: W, height: Hh, class: 'wb' });
  const ctx = canvas.getContext('2d');
  let color = '#1f2937', size = 3, cur = null;
  const draw = () => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, Hh);
    for (const e of st(it).strokes || []) stroke(e.v);
  };
  const stroke = (s) => {
    if (!s?.p?.length) return;
    ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(s.p[0][0], s.p[0][1]);
    for (const [x, y] of s.p) ctx.lineTo(x, y);
    ctx.stroke();
  };
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * Hh / r.height)]; };
  canvas.addEventListener('pointerdown', (e) => { cur = { c: color, w: size, p: [pos(e)] }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!cur) return; const p = pos(e); const l = cur.p[cur.p.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2) return; cur.p.push(p); stroke({ ...cur, p: cur.p.slice(-2) }); });
  const up = async () => { if (!cur) return; const s = cur; cur = null; if (s.p.length < 2) s.p.push([s.p[0][0] + 1, s.p[0][1]]); try { await A.itemOp(it.uid, 'list_add', { key: 'strokes', value: s, max: 600 }); } catch { /* */ } };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const colors = ['#1f2937', '#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#a855f7'];
  const tools = el('div', { class: 'wb-tools' },
    colors.map((c) => el('button', { class: 'swatch', style: { background: c }, onclick: () => { color = c; size = 3; } })),
    el('button', { class: 'btn small', onclick: () => { color = '#ffffff'; size = 18; } }, '🧽 Radír'),
    el('button', { class: 'btn small', onclick: () => { size = size === 3 ? 7 : 3; } }, '✏️ Vastagság'),
    el('button', { class: 'btn small danger', onclick: () => { if (confirm('Letörlöd az egész táblát?')) A.itemOp(it.uid, 'list_clear', { key: 'strokes' }); } }, 'Tábla törlése'));
  A.setAct('draw');
  modal('✏️ ' + nameOf(it), el('div', {}, tools, canvas), { xl: true, fullscreen: true, onClose: () => { wbOpen = null; A.setAct(null); } });
  wbOpen = { uid: it.uid, draw };
  draw();
}

// Parafatábla: cetlik
let corkOpen = null;
function openCork(it) {
  const list = el('div', { class: 'cork' });
  const render = () => {
    list.innerHTML = '';
    const notes = st(it).notes || [];
    if (!notes.length) list.append(el('p', { class: 'muted-text' }, 'Még nincs cetli. Ragassz fel egyet!'));
    for (const n of notes) {
      list.append(el('div', { class: 'note', style: { background: n.v?.color || '#fde047' } },
        el('div', { html: esc(n.v?.text || '').replace(/\n/g, '<br>') }),
        el('small', {}, `${n.by} · ${timeLabel(n.at)}`),
        el('button', { class: 'note-x', title: 'Leveszem', onclick: () => A.itemOp(it.uid, 'list_remove', { key: 'notes', id: n.id }) }, '×')));
    }
  };
  const ta = el('textarea', { rows: 2, maxlength: 300, placeholder: 'Új cetli…' });
  let col = '#fde047';
  const cols = el('div', { class: 'swatches' }, ['#fde047', '#f9a8d4', '#86efac', '#93c5fd'].map((c) => el('button', { class: 'swatch', style: { background: c }, onclick: () => { col = c; } })));
  modal('📌 ' + nameOf(it), el('div', { class: 'form' }, list, ta, cols,
    el('button', { class: 'btn primary', onclick: async () => { if (!ta.value.trim()) return; await A.itemOp(it.uid, 'list_add', { key: 'notes', value: { text: ta.value.trim(), color: col }, max: 40 }); ta.value = ''; } }, '📌 Felragasztom')),
  { wide: true, onClose: () => { corkOpen = null; } });
  corkOpen = { uid: it.uid, render };
  render();
}

// Ötletláda (névtelen)
function openIdeas(it) {
  const list = el('div', { class: 'ideas' });
  const render = () => {
    list.innerHTML = '';
    const ideas = st(it).ideas || [];
    if (!ideas.length) list.append(el('p', { class: 'muted-text' }, 'Még üres a láda.'));
    for (const i of ideas.slice().reverse()) list.append(el('div', { class: 'idea' }, '💡 ' + (i.v || ''), el('small', {}, ' – névtelen, ' + timeLabel(i.at))));
  };
  const ta = el('textarea', { rows: 3, maxlength: 500, placeholder: 'Névtelen ötlet, javaslat…' });
  modal('💡 Ötletláda', el('div', { class: 'form' }, ta,
    el('button', { class: 'btn primary', onclick: async () => { if (!ta.value.trim()) return; await A.itemOp(it.uid, 'list_add', { key: 'ideas', value: ta.value.trim(), max: 200 }); ta.value = ''; render(); toast('Köszönjük az ötletet! 💡'); } }, 'Bedobom'),
    el('h4', {}, 'Korábbi ötletek'), list), { wide: true });
  render();
}

function chooseUser(title, cb) {
  const users = [...S.users.values()].filter((u) => u.online && u.id !== S.me.id);
  if (!users.length) return toast('Most nincs más online.');
  choose(title, users.map((u) => ({ icon: '👤', label: u.name, u })), (o) => cb(o.u));
}

// ---------------------------------------------------------------- pingpong / csocsó párosítás

function pongEntries(it, s) {
  const out = [];
  const w = s.wait;
  const waiter = w && w.id !== S.me.id ? S.users.get(w.id) : null;
  if (waiter && waiter.online && Date.now() / 1000 - (w.at || 0) < 600) {
    out.push({ icon: '🏓', label: `Beállok ${waiter.name} ellen`, primary: true, run: () => A.sendTo(waiter.id, { t: 'game', g: 'pong', a: 'join', uid: it.uid }) });
  } else if (w && w.id === S.me.id) {
    out.push({ icon: '⏳', label: 'Mégsem várok tovább', run: () => A.itemOp(it.uid, 'set', { patch: { wait: null } }) });
  } else {
    out.push({ icon: '⏳', label: 'Várok ellenfélre', run: () => { A.itemOp(it.uid, 'set', { patch: { wait: { id: S.me.id, name: S.me.name, at: Math.floor(Date.now() / 1000) } } }); A.setAct('pong'); toast('Várod az ellenfelet. Aki rákattint az asztalra, beállhat.'); } });
    out.push({ icon: '📨', label: 'Meghívok valakit', run: () => chooseUser('Kit hívsz meg játszani?', (u) => { A.sendTo(u.id, { t: 'game', g: 'pong', a: 'invite', uid: it.uid }); toast(`Meghívtad: ${u.name}`); }) });
  }
  out.push({ icon: '🤖', label: 'Játék a gép ellen', run: () => games.openPong(it, { opponent: null, host: true }) });
  return out;
}

/** Játékkal kapcsolatos üzenetek a többiektől. */
export function onGameMessage(from, msg) {
  if (msg.g !== 'pong') return;
  const it = S.items.find((i) => i.uid === msg.uid);
  const name = S.users.get(from)?.name || 'Valaki';
  if (msg.a === 'join') {
    // valaki beállt ellenem
    if (!it || st(it).wait?.id !== S.me.id) return A.sendTo(from, { t: 'game', g: 'pong', a: 'busy' });
    A.itemOp(it.uid, 'set', { patch: { wait: null } });
    A.sendTo(from, { t: 'game', g: 'pong', a: 'start', uid: it.uid });
    games.openPong(it, { opponent: from, host: true });
  } else if (msg.a === 'invite' && it) {
    toast(`${name} meghívott: ${CATALOG[it.type].label} 🏓`, { timeout: 20000, actions: [{ label: 'Nem most' }, { label: 'Játszom!', primary: true, onClick: () => A.sendTo(from, { t: 'game', g: 'pong', a: 'accept', uid: it.uid }) }] });
  } else if (msg.a === 'accept' && it) {
    A.sendTo(from, { t: 'game', g: 'pong', a: 'start', uid: it.uid });
    games.openPong(it, { opponent: from, host: true });
  } else if (msg.a === 'start' && it) {
    map.walkToItem(it, () => {});
    games.openPong(it, { opponent: from, host: false });
  } else if (msg.a === 'busy') toast('Ez a játék már nem elérhető.');
  else games.onPongMessage(from, msg);
}

// Ranglista (snake, darts)
async function saveScore(it, score) {
  if (!score) return;
  const scores = (st(it).scores || []).concat([{ name: S.me.name, score, at: Math.floor(Date.now() / 1000) }]).sort((a, b) => b.score - a.score).slice(0, 10);
  try { await A.itemOp(it.uid, 'set', { patch: { scores } }); } catch { /* */ }
  if (scores[0].score === score && scores[0].name === S.me.name) { toast('🏆 Új rekord!', { type: 'ok' }); A.broadcastAll({ t: 'fx', kind: 'text', text: `🏆 ${S.me.name} új rekordot ért el: ${score} pont (${CATALOG[it.type].label})` }); }
}

function renderScores(box, it) {
  const draw = () => {
    box.innerHTML = '';
    const sc = st(it).scores || [];
    box.append(el('h4', {}, 'Ranglista'), sc.length ? el('ol', {}, sc.map((s) => el('li', {}, `${s.name} – ${s.score}`))) : el('p', { class: 'muted-text small' }, 'Még nincs eredmény.'));
  };
  draw();
  box._draw = draw;
  scoreBoxes.set(it.uid, box);
}
const scoreBoxes = new Map();

/** Egy tárgy állapota változott (másik felhasználótól vagy tőlünk): nyitott ablakok frissítése. */
export function onStateChanged(uid) {
  if (wbOpen?.uid === uid) wbOpen.draw();
  if (corkOpen?.uid === uid) corkOpen.render();
  const sb = scoreBoxes.get(uid);
  if (sb?.isConnected) sb._draw(); else scoreBoxes.delete(uid);
}

// ---------------------------------------------------------------- tartott tárgy, emojik

const CONSUME = { coffee: 'Megiszom', tea: 'Megiszom', water: 'Megiszom', soda: 'Megiszom', juice: 'Megiszom', apple: 'Megeszem', banana: 'Megeszem', cookie: 'Megeszem', pizza: 'Megeszem', cake: 'Megeszem', popcorn: 'Megeszem', toast: 'Megeszem', sausage: 'Megeszem', chocolate: 'Megeszem', chips: 'Megeszem', icecream: 'Megeszem', book: 'Olvasok belőle' };

export function holdMenu() {
  const h = S.local.hold;
  if (!h) return;
  const entries = [];
  if (CONSUME[h]) entries.push({ icon: HOLD_EMOJI[h], label: CONSUME[h], run: () => (h === 'book' ? openBook() : process('drink', 3000, () => { A.setHold(h === 'coffee' || h === 'tea' ? 'mug' : null); A.emote('😋'); if (h === 'coffee') toast('☕ Feltöltődtél!'); })) });
  entries.push({ icon: '🎁', label: 'Odaadom valakinek', run: () => chooseUser('Kinek adod?', (u) => A.give(u.id)) });
  entries.push({ icon: '🗑️', label: 'Leteszem / eldobom', run: () => A.setHold(null) });
  choose(`A kezedben: ${HOLD_EMOJI[h]}`, entries.map((e) => ({ ...e })), (o) => o.run());
}

export const EMOTES = [['👋', 'Integetés'], ['👏', 'Taps'], ['❤️', 'Szív'], ['😂', 'Nevetés'], ['👍', 'Szuper'], ['🎉', 'Ünneplés'], ['☕', 'Kávészünet?'], ['🤔', 'Gondolkodom'], ['💃', 'Tánc']];

export function emoteMenu() {
  choose('Mit csinálsz?', EMOTES.map(([icon, label]) => ({ icon, label })), (o) => {
    if (o.icon === '💃') A.setAct('dance', true);
    else A.emote(o.icon);
  });
}

function hashUid(uid = '') { let h = 7; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h % 1000) + 1; }

export { zoneById };
