// Vezérlősáv, videósáv és a beállító ablakok.

import { S, on, zoneById, audible, meAsUser } from './store.js';
import { el, api, modal, toast, ICONS, initials } from './util.js';
import * as media from './media.js';
import * as map from './map.js';
import * as chat from './chat.js';

let hooks = {};
let bar, stage, editPanel;

export function initUi({ barContainer, stageContainer, mapContainer }, h) {
  hooks = h;
  bar = el('footer', { class: 'bar' });
  barContainer.append(bar);
  stage = el('div', { class: 'stage hidden' });
  stageContainer.append(stage);
  editPanel = el('div', { class: 'edit-panel card hidden' });
  mapContainer.append(editPanel);
  renderBar();
  on('unread', renderBar);
  on('zone', renderBar);
  on('users', renderBar);
  on('local', renderBar);
  on('chatOpen', renderBar);
}

// ---------------------------------------------------------------- vezérlősáv

function locationInfo() {
  if (S.local.call) {
    const u = S.users.get(S.local.call);
    return { text: `📞 Hívásban: ${u?.name || '?'}`, hint: '' };
  }
  const z = zoneById(S.local.zone);
  if (!z) return { text: 'Nyitott tér', hint: 'Itt nem hall senkit. Lépj be egy szobába a beszélgetéshez.' };
  if (z.kind === 'quiet') return { text: `🤫 ${z.name}`, hint: 'Csendes szoba: itt senki nem hall senkit.' };
  const me = meAsUser();
  const n = [...S.users.values()].filter((u) => u.online && audible(me, u)).length;
  return { text: z.name, hint: n ? `${n} kollégát hallasz` : 'Egyedül vagy itt' };
}

let barKey = '';
export function renderBar() {
  if (!bar || !S.me) return;
  const loc = locationInfo();
  const micBroken = !media.local.micTrack;
  const unread = chat.totalUnread();
  // Csak akkor rajzoljuk újra, ha tényleg változott valami (különben pl. a nyitott menü bezárulna).
  const key = JSON.stringify([loc, micBroken, unread, S.local.mic, S.local.cam, S.local.screen, S.local.call, S.local.status, chat.isOpen(), map.isEditing(), S.me.isAdmin]);
  if (key === barKey) return;
  barKey = key;
  bar.innerHTML = '';
  bar.append(
    el('div', { class: 'bar-left' },
      el('div', { class: 'loc' }, el('strong', {}, loc.text), loc.hint ? el('span', {}, loc.hint) : null),
      S.local.status === 'busy' && !S.local.call ? el('span', { class: 'pill warn' }, 'Elfoglalt: a szobában sem hallanak') : null),
    el('div', { class: 'bar-center' },
      el('button', {
        class: `round ${micBroken ? 'danger' : S.local.mic ? '' : 'off'}`,
        title: micBroken ? 'Nincs mikrofon engedély – kattints az újrapróbáláshoz' : S.local.mic ? 'Némítás (M)' : 'Mikrofon be (M)',
        onclick: () => hooks.toggleMic(),
        html: micBroken || !S.local.mic ? ICONS.micOff : ICONS.mic,
      }),
      el('button', { class: `round ${S.local.cam ? 'on' : ''}`, title: S.local.cam ? 'Kamera ki' : 'Kamera be', onclick: () => hooks.toggleCam(), html: S.local.cam ? ICONS.cam : ICONS.camOff }),
      el('button', { class: `round ${S.local.screen ? 'on' : ''}`, title: S.local.screen ? 'Képernyőmegosztás leállítása' : 'Képernyőmegosztás', onclick: () => hooks.toggleScreen(), html: ICONS.screen }),
      S.local.call ? el('button', { class: 'round danger', title: 'Hívás vége', onclick: () => hooks.endCall(), html: ICONS.phoneOff }) : null,
      statusSelect()),
    el('div', { class: 'bar-right' },
      el('button', { class: `icon-btn ${chat.isOpen() ? 'active' : ''}`, title: 'Chat (C)', onclick: () => chat.toggle(), html: ICONS.chat },
        unread ? el('span', { class: 'badge' }, unread > 99 ? '99+' : unread) : null),
      el('button', { class: 'icon-btn', title: 'Profil', onclick: openProfile, html: ICONS.user }),
      el('button', { class: 'icon-btn', title: 'Hang és kép beállítások', onclick: openSettings, html: ICONS.settings }),
      S.me.isAdmin ? el('button', { class: `icon-btn ${map.isEditing() ? 'active' : ''}`, title: 'Térkép szerkesztése', onclick: toggleEditor, html: ICONS.map }) : null,
      S.me.isAdmin ? el('button', { class: 'icon-btn', title: 'Felhasználók', onclick: openUsers, html: ICONS.users }) : null,
      el('button', { class: 'icon-btn', title: 'Kilépés', onclick: () => hooks.logout(), html: ICONS.logout })));
}

function statusSelect() {
  const sel = el('select', { class: 'status-select', title: 'Állapot', onchange: (e) => hooks.setStatus(e.target.value) },
    el('option', { value: 'available' }, '🟢 Elérhető'),
    el('option', { value: 'busy' }, '🔴 Elfoglalt'),
    el('option', { value: 'away' }, '🟡 Távol'));
  sel.value = S.local.status;
  return sel;
}

// ---------------------------------------------------------------- videósáv

const tiles = new Map(); // kulcs -> { node, video, track }
let focused = null;

/**
 * @param {Map<number,{cam?:MediaStreamTrack, screen?:MediaStreamTrack}>} remoteVideo
 */
export function renderVideos(remoteVideo) {
  if (!stage) return;
  const want = [];
  if (media.local.camTrack && S.local.cam) want.push({ key: 'me:cam', track: media.local.camTrack, name: 'Te', mirror: true });
  if (media.local.screenTrack && S.local.screen) want.push({ key: 'me:screen', track: media.local.screenTrack, name: 'Te (képernyő)', screen: true });
  const me = meAsUser();
  for (const u of S.users.values()) {
    if (!u.online || !audible(me, u)) continue;
    const v = remoteVideo.get(u.id) || {};
    if (u.cam && v.cam) want.push({ key: u.id + ':cam', track: v.cam, name: u.name });
    if (u.screen && v.screen) want.push({ key: u.id + ':screen', track: v.screen, name: u.name + ' (képernyő)', screen: true });
  }
  const keys = new Set(want.map((w) => w.key));
  for (const [k, t] of tiles) if (!keys.has(k)) { t.node.remove(); tiles.delete(k); if (focused === k) focused = null; }
  for (const w of want) {
    let t = tiles.get(w.key);
    if (!t) {
      const video = el('video', { autoplay: true, playsinline: true, muted: true });
      video.muted = true;
      const node = el('div', { class: `tile ${w.screen ? 'screen' : ''} ${w.mirror ? 'mirror' : ''}` }, video,
        el('div', { class: 'tile-name' }, w.name),
        el('button', { class: 'tile-btn', title: 'Nagyítás', html: ICONS.expand, onclick: () => { focused = focused === w.key ? null : w.key; layoutFocus(); } }));
      node.addEventListener('dblclick', () => { focused = focused === w.key ? null : w.key; layoutFocus(); });
      t = { node, video, track: null };
      tiles.set(w.key, t);
      stage.append(node);
      // Képernyőmegosztás indulásakor automatikusan nagyban mutatjuk.
      if (w.screen && !w.key.startsWith('me:') && !focused) focused = w.key;
    }
    if (t.track !== w.track) {
      t.track = w.track;
      t.video.srcObject = new MediaStream([w.track]);
      t.video.play().catch(() => {});
    }
  }
  stage.classList.toggle('hidden', tiles.size === 0);
  layoutFocus();
}

function layoutFocus() {
  stage.classList.toggle('has-focus', !!focused && tiles.has(focused));
  for (const [k, t] of tiles) t.node.classList.toggle('focused', k === focused);
}

// ---------------------------------------------------------------- profil

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b', '#a16207'];

function openProfile() {
  let color = S.me.color;
  const nameIn = el('input', { value: S.me.name, maxlength: 40 });
  const emojiIn = el('input', { value: S.me.emoji || '', maxlength: 4, placeholder: 'pl. 😎 (üresen a monogram látszik)' });
  const preview = el('div', { class: 'av-preview' });
  const paint = () => { preview.style.background = color; preview.textContent = emojiIn.value.trim() || initials(nameIn.value); };
  nameIn.addEventListener('input', paint);
  emojiIn.addEventListener('input', paint);
  const swatches = el('div', { class: 'swatches' }, PALETTE.map((c) => el('button', {
    class: 'swatch', type: 'button', style: { background: c }, title: c,
    onclick: () => { color = c; picker.value = c; paint(); },
  })));
  const picker = el('input', { type: 'color', value: color, oninput: (e) => { color = e.target.value; paint(); } });
  paint();

  const oldPw = el('input', { type: 'password', autocomplete: 'current-password' });
  const newPw = el('input', { type: 'password', autocomplete: 'new-password', minlength: 6 });

  const close = modal('Profil', el('div', { class: 'form' },
    el('div', { class: 'profile-top' }, preview, el('div', { class: 'grow' }, el('label', {}, 'Megjelenített név', nameIn), el('label', {}, 'Emoji az avataron', emojiIn))),
    el('label', {}, 'Szín'), swatches, el('label', { class: 'inline' }, 'Egyéni szín: ', picker),
    el('button', {
      class: 'btn primary', onclick: async () => {
        try {
          const res = await api('profile', { name: nameIn.value, emoji: emojiIn.value, color });
          Object.assign(S.me, res.user);
          hooks.profileChanged();
          close();
        } catch (e) { toast('Nem sikerült menteni: ' + e.code, { type: 'error' }); }
      },
    }, 'Mentés'),
    el('hr'),
    el('h3', {}, 'Jelszó módosítása'),
    el('label', {}, 'Jelenlegi jelszó', oldPw),
    el('label', {}, 'Új jelszó (legalább 6 karakter)', newPw),
    el('button', {
      class: 'btn', onclick: async () => {
        try {
          await api('password', { old: oldPw.value, new: newPw.value });
          toast('A jelszó megváltozott.', { type: 'ok' });
          oldPw.value = newPw.value = '';
        } catch (e) {
          toast(e.code === 'invalid_password' ? 'Hibás jelenlegi jelszó.' : e.code === 'password_too_short' ? 'Az új jelszó túl rövid.' : 'Hiba: ' + e.code, { type: 'error' });
        }
      },
    }, 'Jelszó módosítása')));
}

// ---------------------------------------------------------------- hang/kép beállítások

async function openSettings() {
  const devs = await media.listDevices();
  const p = media.prefs;
  const mkSelect = (list, value, fallback) => {
    const s = el('select', {}, el('option', { value: '' }, fallback), list.map((d, i) => el('option', { value: d.deviceId }, d.label || `Eszköz ${i + 1}`)));
    s.value = list.some((d) => d.deviceId === value) ? value : '';
    return s;
  };
  const micSel = mkSelect(devs.mics, p.micId, 'Alapértelmezett mikrofon');
  const spkSel = mkSelect(devs.speakers, p.speakerId, 'Alapértelmezett hangszóró');
  const camSel = mkSelect(devs.cams, p.camId, 'Alapértelmezett kamera');
  const ns = el('input', { type: 'checkbox' }); ns.checked = p.noiseSuppression;
  const ec = el('input', { type: 'checkbox' }); ec.checked = p.echoCancellation;
  const ag = el('input', { type: 'checkbox' }); ag.checked = p.autoGain;
  const meterBar = el('div', { class: 'meter-fill' });
  let meter = null;
  if (media.local.micStream) { try { meter = new media.LevelMeter(media.local.micStream); } catch { /* */ } }
  const iv = setInterval(() => { if (meter) meterBar.style.width = Math.min(100, meter.level() * 400) + '%'; }, 80);
  const close = modal('Hang és kép', el('div', { class: 'form' },
    el('label', {}, 'Mikrofon', micSel),
    el('div', { class: 'meter' }, meterBar),
    el('label', {}, 'Hangszóró / fejhallgató', spkSel),
    typeof HTMLMediaElement.prototype.setSinkId !== 'function' ? el('p', { class: 'muted-text' }, 'Ez a böngésző nem támogatja a kimenet választását.') : null,
    el('label', {}, 'Kamera', camSel),
    el('label', { class: 'check' }, ns, 'Zajszűrés (háttérzaj, billentyűzet)'),
    el('label', { class: 'check' }, ec, 'Visszhangszűrés (hangszóró használatakor fontos)'),
    el('label', { class: 'check' }, ag, 'Automatikus hangerő'),
    el('p', { class: 'muted-text' }, 'Tipp: fejhallgatóval a legjobb a hangminőség.'),
    el('button', {
      class: 'btn primary', onclick: async () => {
        const micChanged = micSel.value !== p.micId || ns.checked !== p.noiseSuppression || ec.checked !== p.echoCancellation || ag.checked !== p.autoGain;
        Object.assign(p, { micId: micSel.value, speakerId: spkSel.value, camId: camSel.value, noiseSuppression: ns.checked, echoCancellation: ec.checked, autoGain: ag.checked });
        media.savePrefs();
        close();
        if (micChanged) await hooks.restartMic();
        hooks.applySpeaker();
      },
    }, 'Mentés')), { onClose: () => { clearInterval(iv); meter?.dispose(); } });
}

// ---------------------------------------------------------------- felhasználók (admin)

async function openUsers() {
  const box = el('div', { class: 'form' });
  const close = modal('Felhasználók', box, { wide: true });
  const load = async () => {
    let users = [];
    try { users = (await api('users_list')).users; } catch (e) { toast('Hiba: ' + e.code, { type: 'error' }); return; }
    box.innerHTML = '';
    const table = el('table', { class: 'table' }, el('tr', {}, el('th', {}, 'Név'), el('th', {}, 'Felhasználónév'), el('th', {}, 'Admin'), el('th', {})));
    for (const u of users) {
      table.append(el('tr', {}, el('td', {}, u.name), el('td', {}, u.username), el('td', {}, u.isAdmin ? 'igen' : ''),
        el('td', { class: 'right' },
          el('button', { class: 'btn small', onclick: () => editUser(u) }, 'Szerkesztés'),
          u.id !== S.me.id ? el('button', {
            class: 'btn small danger', onclick: async () => {
              if (!confirm(`Biztosan törlöd: ${u.name}?`)) return;
              try { await api('user_delete', { id: u.id }); load(); } catch (e) { toast('Hiba: ' + e.code, { type: 'error' }); }
            },
          }, 'Törlés') : null)));
    }
    box.append(table, el('button', { class: 'btn primary', onclick: () => editUser(null), html: `${ICONS.plus}<span>Új felhasználó</span>` }));
  };
  const editUser = (u) => {
    const un = el('input', { value: u?.username || '', placeholder: 'pl. anna', autocomplete: 'off' });
    const nm = el('input', { value: u?.name || '', placeholder: 'pl. Kovács Anna' });
    const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: u ? 'üresen hagyva nem változik' : 'legalább 6 karakter' });
    const ad = el('input', { type: 'checkbox' }); ad.checked = !!u?.isAdmin;
    const c2 = modal(u ? 'Felhasználó szerkesztése' : 'Új felhasználó', el('div', { class: 'form' },
      el('label', {}, 'Felhasználónév (belépéshez)', un),
      el('label', {}, 'Megjelenített név', nm),
      el('label', {}, 'Jelszó', pw),
      el('label', { class: 'check' }, ad, 'Admin (térképet és felhasználókat kezelhet)'),
      el('button', {
        class: 'btn primary', onclick: async () => {
          try {
            await api('user_save', { id: u?.id || 0, username: un.value, name: nm.value, password: pw.value, isAdmin: ad.checked });
            c2();
            load();
          } catch (e) {
            const msg = { bad_username: 'A felhasználónév csak kisbetű, szám, pont, kötőjel lehet.', username_taken: 'Ez a felhasználónév foglalt.', password_too_short: 'A jelszó legalább 6 karakter legyen.' }[e.code] || 'Hiba: ' + e.code;
            toast(msg, { type: 'error' });
          }
        },
      }, 'Mentés')));
  };
  load();
  return close;
}

// ---------------------------------------------------------------- térképszerkesztő panel

function toggleEditor() {
  if (map.isEditing()) { map.stopEditing(); editPanel.classList.add('hidden'); }
  else { map.startEditing(); renderEditPanel(null); editPanel.classList.remove('hidden'); }
  renderBar();
}

export function renderEditPanel(zone) {
  const st = map.editState();
  if (!st) return;
  editPanel.innerHTML = '';
  const wIn = el('input', { type: 'number', value: st.world.w, min: 600, max: 6000, step: 50 });
  const hIn = el('input', { type: 'number', value: st.world.h, min: 400, max: 6000, step: 50 });
  const sizeChange = () => map.setWorldSize(Number(wIn.value), Number(hIn.value));
  wIn.addEventListener('change', sizeChange);
  hIn.addEventListener('change', sizeChange);
  editPanel.append(el('h3', {}, 'Térkép szerkesztése'),
    el('p', { class: 'muted-text' }, 'Húzd a szobákat a mozgatáshoz, a jobb alsó sarkukat az átméretezéshez.'),
    el('button', { class: 'btn block', onclick: () => map.addZone(), html: `${ICONS.plus}<span>Új szoba</span>` }));
  if (zone) {
    const name = el('input', { value: zone.name, maxlength: 64, oninput: (e) => { zone.name = e.target.value; map.renderZones(); } });
    const kind = el('select', { onchange: (e) => { zone.kind = e.target.value; map.renderZones(); } },
      el('option', { value: 'talk' }, 'Beszélgetős (a bent lévők hallják egymást)'),
      el('option', { value: 'quiet' }, 'Csendes (senki nem hall senkit)'));
    kind.value = zone.kind;
    const color = el('input', { type: 'color', value: zone.color, oninput: (e) => { zone.color = e.target.value; map.renderZones(); } });
    editPanel.append(el('div', { class: 'form' },
      el('h4', {}, 'Kijelölt szoba'),
      el('label', {}, 'Név', name), el('label', {}, 'Típus', kind), el('label', { class: 'inline' }, 'Szín: ', color),
      el('button', { class: 'btn danger block', onclick: () => map.deleteSelectedZone(), html: `${ICONS.trash}<span>Szoba törlése</span>` })));
  }
  editPanel.append(el('div', { class: 'form' }, el('h4', {}, 'Térkép mérete'), el('div', { class: 'row' }, el('label', {}, 'Szélesség', wIn), el('label', {}, 'Magasság', hIn))),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => { map.stopEditing(); editPanel.classList.add('hidden'); renderBar(); } }, 'Mégse'),
      el('button', { class: 'btn primary', onclick: async () => { if (await map.saveEditing()) { editPanel.classList.add('hidden'); hooks.mapSaved(); renderBar(); } } }, 'Mentés')));
}
