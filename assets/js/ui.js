// Vezérlősáv, videósáv és a beállító ablakok.

import { S, on, zoneById, audible, meAsUser } from './store.js';
import { el, api, modal, toast, ICONS } from './util.js';
import * as media from './media.js';
import * as map from './map.js';
import * as chat from './chat.js';
import * as editor from './editor.js';
import { AVATAR_OPTIONS, avatarSVG, defaultAvatar } from './avatar.js';
import { HOLD_EMOJI } from './map.js';

let hooks = {};
let bar, stage;

export function initUi({ barContainer, stageContainer, mapContainer }, h) {
  hooks = h;
  bar = el('footer', { class: 'bar' });
  barContainer.append(bar);
  stage = el('div', { class: 'stage hidden' });
  stageContainer.append(stage);
  editor.initEditor(mapContainer, {
    onSaved: () => { hooks.mapSaved(); renderBar(); },
    onClose: () => renderBar(),
  });
  renderBar();
  on('unread', renderBar);
  on('zone', renderBar);
  on('users', renderBar);
  on('local', renderBar);
  on('chatOpen', renderBar);
}

export function renderEditPanel(sel) {
  editor.render(sel);
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
  const perms = S.me.perms || {};
  // Csak akkor rajzoljuk újra, ha tényleg változott valami (különben pl. a nyitott menü bezárulna).
  const key = JSON.stringify([loc, micBroken, unread, S.local.mic, S.local.cam, S.local.screen, S.local.call, S.local.status, chat.isOpen(), map.isEditing(), perms, S.local.hold]);
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
      el('button', { class: 'round', title: 'Integetés, taps, tánc… (E)', onclick: () => hooks.emoteMenu(), html: ICONS.smile }),
      S.local.hold ? el('button', { class: 'round hold-btn', title: 'Ami a kezedben van', onclick: () => hooks.holdMenu() }, HOLD_EMOJI[S.local.hold] || '🎁') : null,
      statusSelect()),
    el('div', { class: 'bar-right' },
      el('button', { class: `icon-btn ${chat.isOpen() ? 'active' : ''}`, title: 'Chat (C)', onclick: () => chat.toggle(), html: ICONS.chat },
        unread ? el('span', { class: 'badge' }, unread > 99 ? '99+' : unread) : null),
      el('button', { class: 'icon-btn', title: 'Profil és avatar', onclick: openProfile, html: ICONS.user }),
      el('button', { class: 'icon-btn', title: 'Beállítások', onclick: openSettings, html: ICONS.settings }),
      perms.map ? el('button', { class: `icon-btn ${map.isEditing() ? 'active' : ''}`, title: 'Térkép és berendezés szerkesztése', onclick: toggleEditor, html: ICONS.map }) : null,
      perms.users ? el('button', { class: 'icon-btn', title: 'Felhasználók', onclick: openUsers, html: ICONS.users }) : null,
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

function toggleEditor() {
  if (map.isEditing()) editor.close();
  else editor.open();
  renderBar();
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

// ---------------------------------------------------------------- profil és avatar

export function openProfile() {
  const av = { ...defaultAvatar(), ...(S.me.avatar || {}) };
  const nameIn = el('input', { type: 'text', value: S.me.name, maxlength: 40 });
  const preview = el('div', { class: 'av-preview' });
  let dirIdx = 0;
  const dirs = ['down', 'left', 'up', 'right'];
  const paint = () => {
    preview.innerHTML = dirs.map((d, i) => `<div class="pv ${i === dirIdx ? 'big' : ''}">${avatarSVG(av, d)}</div>`).join('');
  };
  const swatchRow = (colors, key) => el('div', { class: 'swatches' }, colors.map((c) => el('button', {
    class: `swatch ${av[key] === c ? 'active' : ''}`, type: 'button', style: { background: c }, title: c,
    onclick: (e) => { av[key] = c; e.currentTarget.parentNode.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active')); e.currentTarget.classList.add('active'); paint(); },
  })), el('input', { type: 'color', value: av[key], title: 'Egyéni szín', oninput: (e) => { av[key] = e.target.value; paint(); } }));
  const optRow = (opts, key) => el('div', { class: 'chips' }, opts.map(([v, l]) => el('button', {
    class: `chip ${av[key] === v ? 'active' : ''}`, type: 'button',
    onclick: (e) => { av[key] = v; e.currentTarget.parentNode.querySelectorAll('.chip').forEach((s) => s.classList.remove('active')); e.currentTarget.classList.add('active'); paint(); },
  }, l)));
  paint();
  preview.addEventListener('click', () => { dirIdx = (dirIdx + 1) % 4; paint(); });

  const oldPw = el('input', { type: 'password', autocomplete: 'current-password' });
  const newPw = el('input', { type: 'password', autocomplete: 'new-password', minlength: 6 });

  const close = modal('Profil és avatar', el('div', { class: 'form' },
    preview,
    el('label', {}, 'Megjelenített név', nameIn),
    el('label', {}, 'Bőrszín'), el('div', { class: 'swatches' }, AVATAR_OPTIONS.skin.map((c) => el('button', {
      class: `swatch ${av.skin === c ? 'active' : ''}`, type: 'button', style: { background: c },
      onclick: (e) => { av.skin = c; e.currentTarget.parentNode.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active')); e.currentTarget.classList.add('active'); paint(); },
    }))),
    el('label', {}, 'Frizura'), optRow(AVATAR_OPTIONS.hair, 'hair'),
    el('label', {}, 'Hajszín'), swatchRow(AVATAR_OPTIONS.hairColors, 'hairColor'),
    el('label', {}, 'Felső'), swatchRow(AVATAR_OPTIONS.clothColors, 'shirt'),
    el('label', {}, 'Nadrág'), swatchRow(AVATAR_OPTIONS.clothColors, 'pants'),
    el('label', {}, 'Kiegészítő'), optRow(AVATAR_OPTIONS.acc, 'acc'),
    el('label', {}, 'Kiegészítő színe (sapka, fejhallgató)'), swatchRow(AVATAR_OPTIONS.clothColors, 'accColor'),
    el('button', {
      class: 'btn primary', onclick: async () => {
        try {
          const res = await api('profile', { name: nameIn.value, avatar: av });
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
    }, 'Jelszó módosítása')), { wide: true });
}

// ---------------------------------------------------------------- beállítások

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
  const noise = el('select', {},
    el('option', { value: 'rnnoise' }, 'Erős (RNNoise) – ajánlott'),
    el('option', { value: 'browser' }, 'Alap (a böngésző beépített szűrője)'),
    el('option', { value: 'off' }, 'Kikapcsolva'));
  noise.value = p.noise;
  const ec = el('input', { type: 'checkbox' }); ec.checked = p.echoCancellation;
  const ag = el('input', { type: 'checkbox' }); ag.checked = p.autoGain;
  const low = el('input', { type: 'checkbox' }); low.checked = p.lowRes;
  const meterBar = el('div', { class: 'meter-fill' });
  let meter = null;
  if (media.local.micStream) { try { meter = new media.LevelMeter(media.local.micStream); } catch { /* */ } }
  const iv = setInterval(() => { if (meter) meterBar.style.width = Math.min(100, meter.level() * 400) + '%'; }, 80);
  const noiseInfo = media.local.noiseError
    ? el('p', { class: 'err small' }, 'Az erős zajszűrés nem indult el ezen a gépen, ezért a böngésző alap szűrője működik.')
    : media.local.noiseActive ? el('p', { class: 'ok small' }, 'Az erős zajszűrés működik.') : null;
  const close = modal('Beállítások', el('div', { class: 'form' },
    el('h4', {}, 'Hang'),
    el('label', {}, 'Mikrofon', micSel),
    el('div', { class: 'meter' }, meterBar),
    el('label', {}, 'Hangszóró / fejhallgató', spkSel),
    typeof HTMLMediaElement.prototype.setSinkId !== 'function' ? el('p', { class: 'muted-text' }, 'Ez a böngésző nem támogatja a kimenet választását.') : null,
    el('label', {}, 'Zajszűrés (háttérzaj, billentyűzet, ventilátor)', noise),
    noiseInfo,
    el('label', { class: 'check' }, ec, 'Visszhangszűrés (hangszóró használatakor fontos)'),
    el('label', { class: 'check' }, ag, 'Automatikus hangerő'),
    el('h4', {}, 'Kép'),
    el('label', {}, 'Kamera', camSel),
    el('h4', {}, 'Megjelenés'),
    el('label', { class: 'check' }, low, 'Takarékos mód: nincsenek animációk, kevesebb gépterhelés (gyengébb gépre, akkuról)'),
    el('p', { class: 'muted-text' }, 'Tipp: fejhallgatóval a legjobb a hangminőség.'),
    el('button', {
      class: 'btn primary', onclick: async () => {
        const micChanged = micSel.value !== p.micId || noise.value !== p.noise || ec.checked !== p.echoCancellation || ag.checked !== p.autoGain;
        Object.assign(p, { micId: micSel.value, speakerId: spkSel.value, camId: camSel.value, noise: noise.value, echoCancellation: ec.checked, autoGain: ag.checked, lowRes: low.checked });
        media.savePrefs();
        hooks.applyLowRes();
        close();
        if (micChanged) await hooks.restartMic();
        hooks.applySpeaker();
      },
    }, 'Mentés')), { onClose: () => { clearInterval(iv); meter?.dispose(); } });
}

// ---------------------------------------------------------------- felhasználók

async function openUsers() {
  const box = el('div', { class: 'form' });
  const close = modal('Felhasználók', box, { wide: true });
  const load = async () => {
    let users = [];
    try { users = (await api('users_list')).users; } catch (e) { toast('Hiba: ' + e.code, { type: 'error' }); return; }
    box.innerHTML = '';
    const table = el('table', { class: 'table' }, el('tr', {}, el('th', {}, 'Név'), el('th', {}, 'Felhasználónév'), el('th', {}, 'Jogok'), el('th', {})));
    for (const u of users) {
      const perms = [u.perms.map ? 'térkép' : null, u.perms.users ? 'felhasználók' : null].filter(Boolean).join(', ');
      table.append(el('tr', {}, el('td', {}, u.name), el('td', {}, u.username), el('td', { class: 'muted-text' }, perms || '–'),
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
    const un = el('input', { type: 'text', value: u?.username || '', placeholder: 'pl. anna', autocomplete: 'off' });
    const nm = el('input', { type: 'text', value: u?.name || '', placeholder: 'pl. Kovács Anna' });
    const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: u ? 'üresen hagyva nem változik' : 'legalább 6 karakter' });
    const pMap = el('input', { type: 'checkbox' }); pMap.checked = !!u?.perms?.map;
    const pUsers = el('input', { type: 'checkbox' }); pUsers.checked = !!u?.perms?.users;
    const self = u && u.id === S.me.id;
    if (self) pUsers.disabled = true;
    const c2 = modal(u ? 'Felhasználó szerkesztése' : 'Új felhasználó', el('div', { class: 'form' },
      el('label', {}, 'Felhasználónév (belépéshez)', un),
      el('label', {}, 'Megjelenített név', nm),
      el('label', {}, 'Jelszó', pw),
      el('h4', {}, 'Jogosultságok'),
      el('label', { class: 'check' }, pMap, 'Térkép és berendezés szerkesztése'),
      el('label', { class: 'check' }, pUsers, 'Felhasználók kezelése' + (self ? ' (a sajátodat nem veheted el)' : '')),
      el('button', {
        class: 'btn primary', onclick: async () => {
          try {
            await api('user_save', { id: u?.id || 0, username: un.value, name: nm.value, password: pw.value, perms: { map: pMap.checked, users: pUsers.checked || self } });
            if (self) { S.me.perms = { map: pMap.checked, users: true }; barKey = ''; renderBar(); }
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
