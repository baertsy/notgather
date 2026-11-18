// Mini játékok: pingpong / csocsó (2 fő vagy gép ellen), snake, darts, zongora, gitár.

import { el, modal, toast } from './util.js';
import { sfx, note } from './sfx.js';

let H = {};   // az app segédfüggvényei
export function initGames(h) { H = h; }

// ======================================================================= PONG (pingpong, csocsó)

const PW = 600, PH = 340, PAD_H = 70, PAD_W = 10, BALL = 7, WIN = 7;
let pong = null;

/**
 * @param {object} it  az asztal
 * @param {{opponent:number|null, host:boolean}} o  opponent=null → gép ellen
 */
export function openPong(it, { opponent = null, host = true } = {}) {
  if (pong) pong.close();
  const foos = it.type === 'foosball';
  const canvas = el('canvas', { width: PW, height: PH, class: 'game-canvas' });
  const info = el('div', { class: 'game-info' });
  const oppName = opponent ? H.userName(opponent) : 'Gép';
  const st = {
    it, foos, opponent, host,
    lp: PH / 2, rp: PH / 2, bx: PW / 2, by: PH / 2, vx: 0, vy: 0, sl: 0, sr: 0,
    over: false, lastSend: 0, lastRemote: performance.now(), raf: 0, serveAt: performance.now() + 1200, keys: new Set(),
  };
  const mine = () => (host ? 'lp' : 'rp');
  const close = modal(`${foos ? '⚽ Csocsó' : '🏓 Pingpong'} – ${host ? H.myName() : oppName} vs ${host ? oppName : H.myName()}`,
    el('div', { class: 'game-wrap' }, canvas, info,
      el('p', { class: 'muted-text small' }, 'Egérrel vagy a W/S, ↑/↓ billentyűkkel irányítasz. Az nyer, aki előbb éri el a 7 pontot.')),
    { xl: true, fullscreen: true, onClose: () => end(true) });
  H.setAct('pong');
  const ctx = canvas.getContext('2d');

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    st[mine()] = Math.max(PAD_H / 2, Math.min(PH - PAD_H / 2, (e.clientY - r.top) * (PH / r.height)));
  });
  const kd = (e) => { if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) { st.keys.add(e.code); e.preventDefault(); } };
  const ku = (e) => st.keys.delete(e.code);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  function serve(dir) {
    st.bx = PW / 2; st.by = PH / 2;
    const a = (Math.random() - 0.5) * 0.8;
    st.vx = Math.cos(a) * 300 * dir; st.vy = Math.sin(a) * 300;
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    // saját ütő billentyűvel
    const k = st.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) st[mine()] = Math.max(PAD_H / 2, st[mine()] - 380 * dt);
    if (k.has('KeyS') || k.has('ArrowDown')) st[mine()] = Math.min(PH - PAD_H / 2, st[mine()] + 380 * dt);

    if (host && !st.over) {
      if (!opponent) {
        // gép: késleltetve követi a labdát
        const target = st.vx > 0 ? st.by : PH / 2;
        st.rp += Math.max(-260 * dt, Math.min(260 * dt, (target - st.rp) * 0.9));
      }
      if (st.vx === 0 && t > st.serveAt) serve(Math.random() < 0.5 ? -1 : 1);
      st.bx += st.vx * dt; st.by += st.vy * dt;
      if (st.by < BALL) { st.by = BALL; st.vy = Math.abs(st.vy); }
      if (st.by > PH - BALL) { st.by = PH - BALL; st.vy = -Math.abs(st.vy); }
      const hitPad = (px, py, side) => {
        if (Math.abs(st.by - py) < PAD_H / 2 + BALL && Math.abs(st.bx - px) < PAD_W / 2 + BALL) {
          const off = (st.by - py) / (PAD_H / 2);
          const sp = Math.min(720, Math.hypot(st.vx, st.vy) * 1.06);
          const ang = off * 0.9;
          st.vx = Math.cos(ang) * sp * side; st.vy = Math.sin(ang) * sp;
          st.bx = px + side * (PAD_W / 2 + BALL + 1);
          sfx.hit();
          H.sendTo(opponent, { t: 'game', g: 'pong', a: 'hit' });
        }
      };
      if (st.vx < 0) hitPad(24, st.lp, 1);
      if (st.vx > 0) hitPad(PW - 24, st.rp, -1);
      if (st.bx < -20 || st.bx > PW + 20) {
        if (st.bx < 0) st.sr++; else st.sl++;
        sfx.score();
        st.vx = 0; st.vy = 0; st.bx = PW / 2; st.by = PH / 2; st.serveAt = t + 1000;
        if (st.sl >= WIN || st.sr >= WIN) finish();
      }
      if (opponent && t - st.lastSend > 33) {
        st.lastSend = t;
        H.sendTo(opponent, { t: 'game', g: 'pong', a: 's', bx: Math.round(st.bx), by: Math.round(st.by), lp: Math.round(st.lp), sl: st.sl, sr: st.sr, over: st.over });
      }
    } else if (!host && t - st.lastSend > 33) {
      st.lastSend = t;
      H.sendTo(opponent, { t: 'game', g: 'pong', a: 'p', y: Math.round(st.rp) });
    }
    if (opponent && t - st.lastRemote > 8000) { toast('Megszakadt a kapcsolat az ellenféllel.'); end(false); return; }
    draw();
    st.raf = requestAnimationFrame(frame);
  }

  function draw() {
    ctx.fillStyle = foos ? '#15803d' : '#1e5aa8';
    ctx.fillRect(0, 0, PW, PH);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, PW - 12, PH - 12);
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(PW / 2, 6); ctx.lineTo(PW / 2, PH - 6); ctx.stroke();
    ctx.setLineDash([]);
    if (foos) {
      ctx.beginPath(); ctx.arc(PW / 2, PH / 2, 40, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, PH / 2 - 50, 8, 100); ctx.fillRect(PW - 8, PH / 2 - 50, 8, 100);
      for (const x of [120, 240, 360, 480]) { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x - 1.5, 0, 3, PH); }
    }
    const pad = (x, y, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x - PAD_W / 2, y - PAD_H / 2, PAD_W, PAD_H, 5); ctx.fill(); };
    pad(24, st.lp, foos ? '#3b82f6' : '#ef4444');
    pad(PW - 24, st.rp, foos ? '#ef4444' : '#111827');
    ctx.fillStyle = foos ? '#f8fafc' : '#fb923c';
    ctx.beginPath(); ctx.arc(st.bx, st.by, BALL, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${st.sl}  :  ${st.sr}`, PW / 2, 46);
    if (st.over) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, PW, PH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px -apple-system, sans-serif';
      const leftWon = st.sl > st.sr;
      const iWon = host ? leftWon : !leftWon;
      ctx.fillText(iWon ? '🏆 Nyertél!' : 'Most nem jött össze…', PW / 2, PH / 2);
    }
  }

  function finish() {
    st.over = true;
    const leftWon = st.sl > st.sr;
    const iWon = host ? leftWon : !leftWon;
    info.innerHTML = '';
    info.append(el('button', { class: 'btn primary', onclick: () => { st.sl = st.sr = 0; st.over = false; st.serveAt = performance.now() + 1000; info.innerHTML = ''; if (opponent) H.sendTo(opponent, { t: 'game', g: 'pong', a: 'again' }); } }, 'Visszavágó'));
    if (iWon) sfx.chime();
    H.announce?.(`${host ? H.myName() : oppName} – ${host ? oppName : H.myName()}: ${st.sl}:${st.sr} ${foos ? '⚽' : '🏓'}`);
  }

  function end(local) {
    if (!pong || pong.st !== st) return;
    cancelAnimationFrame(st.raf);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    if (local && opponent) H.sendTo(opponent, { t: 'game', g: 'pong', a: 'end' });
    H.setAct(null);
    pong = null;
    close();
  }

  pong = {
    st, close: () => end(true),
    remote(msg) {
      st.lastRemote = performance.now();
      if (msg.a === 's' && !host) {
        Object.assign(st, { bx: msg.bx, by: msg.by, lp: msg.lp, sl: msg.sl, sr: msg.sr });
        if (msg.over && !st.over) finish();
        if (!msg.over && st.over) { st.over = false; info.innerHTML = ''; }
      } else if (msg.a === 'p' && host) st.rp = msg.y;
      else if (msg.a === 'hit') sfx.hit();
      else if (msg.a === 'again' && host) { st.sl = st.sr = 0; st.over = false; st.serveAt = performance.now() + 1000; info.innerHTML = ''; }
      else if (msg.a === 'end') { toast(`${oppName} kilépett a játékból.`); end(false); }
    },
  };
  st.raf = requestAnimationFrame(frame);
}

export function onPongMessage(from, msg) {
  if (pong && pong.st.opponent === from) pong.remote(msg);
}

export function pongActive() { return !!pong; }

// ======================================================================= SNAKE (játékautomata)

export function openSnake(it, onScore) {
  const C = 20, GW = 24, GH = 16;
  const canvas = el('canvas', { width: C * GW, height: C * GH, class: 'game-canvas' });
  const scoreEl = el('div', { class: 'game-info' }, 'Pont: 0');
  let snake, dir, nextDir, food, score, alive, timer;
  const reset = () => {
    snake = [[8, 8], [7, 8], [6, 8]]; dir = [1, 0]; nextDir = dir; score = 0; alive = true;
    placeFood(); scoreEl.textContent = 'Pont: 0';
    clearInterval(timer); timer = setInterval(tick, 110);
  };
  const placeFood = () => { do { food = [Math.floor(Math.random() * GW), Math.floor(Math.random() * GH)]; } while (snake.some(([x, y]) => x === food[0] && y === food[1])); };
  const ctx = canvas.getContext('2d');
  function tick() {
    if (!alive) return;
    dir = nextDir;
    const head = [(snake[0][0] + dir[0] + GW) % GW, (snake[0][1] + dir[1] + GH) % GH];
    if (snake.some(([x, y]) => x === head[0] && y === head[1])) {
      alive = false; sfx.fail(); draw();
      clearInterval(timer);
      onScore?.(score);
      return;
    }
    snake.unshift(head);
    if (head[0] === food[0] && head[1] === food[1]) { score += 10; sfx.coin(); placeFood(); scoreEl.textContent = 'Pont: ' + score; clearInterval(timer); timer = setInterval(tick, Math.max(55, 110 - score / 4)); }
    else snake.pop();
    draw();
  }
  function draw() {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(food[0] * C + C / 2, food[1] * C + C / 2, C / 2 - 3, 0, 7); ctx.fill();
    snake.forEach(([x, y], i) => { ctx.fillStyle = i ? '#22c55e' : '#86efac'; ctx.beginPath(); ctx.roundRect(x * C + 1, y * C + 1, C - 2, C - 2, 5); ctx.fill(); });
    if (!alive) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; ctx.font = 'bold 28px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`Vége! ${score} pont · Szóköz: új játék`, canvas.width / 2, canvas.height / 2); }
  }
  const kd = (e) => {
    const m = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[e.code];
    if (m) { e.preventDefault(); if (m[0] !== -dir[0] || m[1] !== -dir[1]) nextDir = m; }
    if (e.code === 'Space') { e.preventDefault(); if (!alive) reset(); }
  };
  window.addEventListener('keydown', kd);
  H.setAct('play');
  const scores = el('div', { class: 'scores' });
  modal('🕹️ Snake', el('div', { class: 'game-wrap' }, canvas, scoreEl, scores, el('p', { class: 'muted-text small' }, 'Nyilakkal vagy WASD-vel irányítasz. Szóköz: új játék.')),
    { xl: true, fullscreen: true, onClose: () => { clearInterval(timer); window.removeEventListener('keydown', kd); H.setAct(null); } });
  H.renderScores?.(scores, it);
  reset();
  draw();
}

// ======================================================================= DARTS

export function openDarts(it, onScore) {
  const S = 380, R = 160;
  const canvas = el('canvas', { width: S, height: S, class: 'game-canvas square' });
  const info = el('div', { class: 'game-info' });
  const ctx = canvas.getContext('2d');
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  let darts = [], total = 0, thrown = 0, raf = 0, t0 = performance.now(), aim = { x: 0, y: 0 };
  const ROUNDS = 9;
  function scoreAt(x, y) {
    const dx = x - S / 2, dy = y - S / 2, r = Math.hypot(dx, dy);
    if (r < 7) return 50;
    if (r < 16) return 25;
    if (r > R) return 0;
    let a = Math.atan2(dx, -dy) * 180 / Math.PI;
    a = (a + 360 + 9) % 360;
    const num = ORDER[Math.floor(a / 18)];
    if (r > 96 && r < 106) return num * 3;
    if (r > R - 10) return num * 2;
    return num;
  }
  function frame(t) {
    const k = (t - t0) / 1000;
    const wob = 70 + Math.min(thrown, 6) * 4;
    aim = { x: S / 2 + Math.sin(k * 1.7) * wob * 0.9 + Math.sin(k * 4.3) * 12, y: S / 2 + Math.cos(k * 1.3) * wob * 0.8 + Math.sin(k * 3.1) * 10 };
    draw();
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 20; i++) {
      const a1 = ((i * 18 - 9 - 90) * Math.PI) / 180, a2 = ((i * 18 + 9 - 90) * Math.PI) / 180;
      for (const [r1, r2, c] of [[0, R, i % 2 ? '#f5f0e1' : '#111']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.arc(S / 2, S / 2, r2, a1, a2); ctx.fill(); }
      for (const [r1, r2] of [[96, 106], [R - 10, R]]) { ctx.fillStyle = i % 2 ? '#16a34a' : '#dc2626'; ctx.beginPath(); ctx.arc(S / 2, S / 2, r2, a1, a2); ctx.arc(S / 2, S / 2, r1, a2, a1, true); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      const am = (i * 18 - 90) * Math.PI / 180;
      ctx.fillText(ORDER[i], S / 2 + Math.cos(am) * (R + 12), S / 2 + Math.sin(am) * (R + 12) + 4);
    }
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 7, 0, 7); ctx.fill();
    for (const d of darts) { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(d.x, d.y, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); }
    if (thrown < ROUNDS) { ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(aim.x, aim.y, 9, 0, 7); ctx.moveTo(aim.x - 14, aim.y); ctx.lineTo(aim.x + 14, aim.y); ctx.moveTo(aim.x, aim.y - 14); ctx.lineTo(aim.x, aim.y + 14); ctx.stroke(); }
  }
  function throwDart() {
    if (thrown >= ROUNDS) { darts = []; total = 0; thrown = 0; info.textContent = ''; return; }
    const p = { x: aim.x + (Math.random() - 0.5) * 8, y: aim.y + (Math.random() - 0.5) * 8 };
    darts.push(p);
    const sc = scoreAt(p.x, p.y);
    total += sc; thrown++;
    sfx.thunk();
    info.textContent = `${thrown}. dobás: ${sc} pont · Összesen: ${total}` + (thrown >= ROUNDS ? ' · Vége! Kattints az új játékhoz.' : '');
    if (thrown % 3 === 0) setTimeout(() => { if (thrown < ROUNDS) darts = []; }, 900);
    if (thrown >= ROUNDS) { sfx.chime(); onScore?.(total); }
  }
  canvas.addEventListener('mousedown', throwDart);
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); throwDart(); } };
  window.addEventListener('keydown', kd);
  H.setAct('play');
  const scores = el('div', { class: 'scores' });
  modal('🎯 Darts', el('div', { class: 'game-wrap' }, canvas, info, scores, el('p', { class: 'muted-text small' }, 'Kattints (vagy szóköz), amikor a célkereszt jó helyen van. 9 dobás, a legtöbb pont nyer.')),
    { wide: true, onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); H.setAct(null); } });
  H.renderScores?.(scores, it);
  raf = requestAnimationFrame(frame);
}

// ======================================================================= ZONGORA, GITÁR

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);
const PIANO_KEYS = { KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67, KeyY: 68, KeyZ: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73, KeyL: 74, KeyP: 75, Semicolon: 76, Quote: 77 };

export function openPiano(it) {
  const keys = el('div', { class: 'piano' });
  const play = (midi) => {
    note(freqOf(midi), 'piano');
    H.broadcastNote(freqOf(midi), 'piano');
    const k = keys.querySelector(`[data-m="${midi}"]`);
    if (k) { k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 160); }
  };
  let white = 0;
  for (let m = 60; m <= 84; m++) {
    const black = [1, 3, 6, 8, 10].includes(m % 12);
    const label = Object.entries(PIANO_KEYS).find(([, v]) => v === m)?.[0]?.replace('Key', '').replace('Semicolon', 'É').replace('Quote', 'Á') || '';
    const k = el('button', { class: `pk ${black ? 'black' : 'white'}`, 'data-m': m, title: NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1), onmousedown: () => play(m) }, el('span', {}, label));
    if (black) k.style.left = `calc(${white} * var(--kw) - var(--kw) * 0.3)`;
    else white++;
    keys.append(k);
  }
  keys.style.setProperty('--n', white);
  const kd = (e) => { if (e.repeat) return; const m = PIANO_KEYS[e.code]; if (m) { e.preventDefault(); play(m); } };
  window.addEventListener('keydown', kd);
  H.setAct('music');
  modal('🎹 Zongora', el('div', { class: 'game-wrap' }, keys, el('p', { class: 'muted-text small' }, 'Kattints a billentyűkre, vagy használd a gépet: A W S E D F T G Z H U J K… – a szobában lévők is hallják.')),
    { xl: true, onClose: () => { window.removeEventListener('keydown', kd); H.setAct(null); } });
}

const CHORDS = { C: [48, 52, 55, 60, 64], G: [43, 47, 50, 55, 59, 67], Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60], D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], E: [40, 47, 52, 56, 59, 64], A: [45, 52, 57, 61, 64] };

export function openGuitar() {
  const strum = (name) => {
    CHORDS[name].forEach((m, i) => setTimeout(() => { note(freqOf(m), 'guitar'); H.broadcastNote(freqOf(m), 'guitar'); }, i * 28));
  };
  const btns = el('div', { class: 'chords' }, Object.keys(CHORDS).map((c, i) => el('button', { class: 'btn chord', onclick: () => strum(c) }, el('strong', {}, c), el('small', {}, String(i + 1)))));
  const kd = (e) => { const n = Number(e.key); if (n >= 1 && n <= 8 && !e.repeat) { e.preventDefault(); strum(Object.keys(CHORDS)[n - 1]); } };
  window.addEventListener('keydown', kd);
  H.setAct('music');
  modal('🎸 Gitár', el('div', { class: 'game-wrap' }, btns, el('p', { class: 'muted-text small' }, 'Kattints egy akkordra, vagy nyomd meg az 1–8 számbillentyűt. Próbáld ki: C – G – Am – F 🎶')),
    { wide: true, onClose: () => { window.removeEventListener('keydown', kd); H.setAct(null); } });
}
