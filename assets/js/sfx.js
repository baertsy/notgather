// Hangeffektek, mind a böngészőben szintetizálva (nincs külső hangfájl).

import { audioContext } from './media.js';

let master = null;
function out() {
  const c = audioContext();
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.6;
    master.connect(c.destination);
  }
  return { c, out: master };
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq, { type = 'sine', dur = 0.2, vol = 0.2, at = 0, attack = 0.005, slide = 0, pan = 0 } = {}) {
  try {
    const { c, out: o } = out();
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    env(g, t, attack, vol, dur);
    let node = osc.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(o);
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
  } catch { /* hang nélkül is működjön */ }
}

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function burst({ dur = 0.15, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', at = 0 } = {}) {
  try {
    const { c, out: o } = out();
    const t = c.currentTime + at;
    const n = noise(c);
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    env(g, t, 0.003, vol, dur);
    n.connect(f).connect(g).connect(o);
    n.start(t);
    n.stop(t + dur + 0.05);
  } catch { /* */ }
}

// ---------------------------------------------------------------- egyszeri hangok

export const sfx = {
  click: () => burst({ dur: 0.03, vol: 0.15, freq: 3000, q: 2 }),
  type: () => { for (let i = 0; i < 4; i++) burst({ dur: 0.025, vol: 0.08, freq: 2500 + Math.random() * 1500, q: 3, at: i * 0.09 + Math.random() * 0.04 }); },
  pop: () => { burst({ dur: 0.12, vol: 0.6, freq: 900, q: 0.7 }); tone(180, { type: 'triangle', dur: 0.1, vol: 0.2, slide: -120 }); },
  gong: () => { [110, 220.5, 331, 447].forEach((f, i) => tone(f, { type: 'sine', dur: 4 - i * 0.6, vol: 0.18 / (i + 1), attack: 0.01 })); burst({ dur: 0.3, vol: 0.15, freq: 400, q: 0.5 }); },
  ding: () => { tone(1318, { dur: 0.6, vol: 0.15 }); tone(1046, { dur: 0.8, vol: 0.15, at: 0.18 }); },
  coin: () => { tone(988, { type: 'square', dur: 0.07, vol: 0.06 }); tone(1319, { type: 'square', dur: 0.25, vol: 0.06, at: 0.07 }); burst({ dur: 0.4, vol: 0.12, freq: 600, q: 0.6, at: 0.5 }); },
  splash: () => { burst({ dur: 0.5, vol: 0.25, freq: 900, q: 0.4 }); burst({ dur: 0.3, vol: 0.15, freq: 2400, q: 1, at: 0.15 }); },
  pour: () => { for (let i = 0; i < 10; i++) burst({ dur: 0.12, vol: 0.06, freq: 500 + Math.random() * 600, q: 6, at: i * 0.12 }); },
  brew: () => { for (let i = 0; i < 16; i++) burst({ dur: 0.08, vol: 0.08, freq: 250 + Math.random() * 300, q: 8, at: i * 0.18 + Math.random() * 0.1 }); tone(80, { type: 'sawtooth', dur: 2.5, vol: 0.02, attack: 0.3 }); },
  print: () => { for (let i = 0; i < 12; i++) tone(180 + (i % 2) * 40, { type: 'square', dur: 0.08, vol: 0.025, at: i * 0.1 }); },
  shred: () => { for (let i = 0; i < 8; i++) burst({ dur: 0.14, vol: 0.12, freq: 300, q: 0.4, at: i * 0.1 }); },
  purr: () => { for (let i = 0; i < 6; i++) tone(28 + Math.random() * 4, { type: 'sawtooth', dur: 0.35, vol: 0.08, at: i * 0.38, attack: 0.08 }); },
  bark: () => { tone(420, { type: 'sawtooth', dur: 0.12, vol: 0.1, slide: -200 }); tone(460, { type: 'sawtooth', dur: 0.12, vol: 0.1, slide: -220, at: 0.22 }); },
  hit: () => { tone(1400, { type: 'triangle', dur: 0.05, vol: 0.2 }); burst({ dur: 0.03, vol: 0.15, freq: 4000, q: 2 }); },
  score: () => { tone(660, { dur: 0.1, vol: 0.12 }); tone(880, { dur: 0.2, vol: 0.12, at: 0.1 }); },
  thunk: () => { tone(140, { type: 'triangle', dur: 0.1, vol: 0.3, slide: -60 }); burst({ dur: 0.04, vol: 0.2, freq: 2000, q: 1 }); },
  ok: () => { tone(784, { dur: 0.08, vol: 0.1 }); tone(1046, { dur: 0.16, vol: 0.1, at: 0.08 }); },
  fail: () => { tone(300, { type: 'triangle', dur: 0.25, vol: 0.12, slide: -120 }); },
  toast: () => { tone(500, { type: 'square', dur: 0.05, vol: 0.05 }); burst({ dur: 0.05, vol: 0.2, freq: 1500, q: 1, at: 0.05 }); },
  microwave: () => { tone(60, { type: 'sawtooth', dur: 2.6, vol: 0.03, attack: 0.1 }); tone(1046, { dur: 0.25, vol: 0.12, at: 2.7 }); tone(1046, { dur: 0.25, vol: 0.12, at: 3.0 }); },
  sizzle: () => { for (let i = 0; i < 20; i++) burst({ dur: 0.06, vol: 0.07, freq: 3000 + Math.random() * 3000, q: 2, at: i * 0.15 + Math.random() * 0.1 }); },
  door: () => { tone(220, { type: 'triangle', dur: 0.15, vol: 0.1, slide: 60 }); burst({ dur: 0.06, vol: 0.12, freq: 800, q: 1, at: 0.12 }); },
  lock: () => { burst({ dur: 0.03, vol: 0.2, freq: 3500, q: 4 }); burst({ dur: 0.03, vol: 0.2, freq: 2500, q: 4, at: 0.08 }); },
  chime: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.4, vol: 0.08, at: i * 0.09 })); },
};

// ---------------------------------------------------------------- hangszerek

export function note(freq, inst = 'piano', pan = 0) {
  if (inst === 'guitar') {
    // pengetett húr: rövid zaj-impulzus + gyors lecsengés (Karplus-Strong közelítés)
    tone(freq, { type: 'triangle', dur: 1.4, vol: 0.14, attack: 0.002, pan });
    tone(freq * 2, { type: 'sine', dur: 0.5, vol: 0.04, attack: 0.002, pan });
    burst({ dur: 0.02, vol: 0.06, freq: freq * 4, q: 3 });
  } else {
    tone(freq, { type: 'triangle', dur: 1.2, vol: 0.16, attack: 0.004, pan });
    tone(freq * 2, { type: 'sine', dur: 0.6, vol: 0.05, attack: 0.004, pan });
    tone(freq * 3, { type: 'sine', dur: 0.25, vol: 0.02, attack: 0.004, pan });
  }
}

// ---------------------------------------------------------------- hangulatok (folyamatos)

/** Madárcsicsergés + szél (+ eső). Visszaad: { stop, setRain, setVolume } */
export function ambience({ birds = true, wind = true, rain = false, fire = false } = {}) {
  const { c } = out();
  const bus = c.createGain();
  bus.gain.value = 0.8;
  bus.connect(master);
  const stops = [];
  let timers = [];

  if (wind) {
    const n = noise(c);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
    const lg = c.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(bus);
    n.start(); lfo.start();
    stops.push(() => { n.stop(); lfo.stop(); });
  }

  let rainNodes = null;
  const setRain = (on) => {
    if (on && !rainNodes) {
      const n = noise(c);
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
      const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 1.5);
      n.connect(f).connect(g).connect(bus);
      n.start();
      const drip = () => { burst({ dur: 0.02, vol: 0.04, freq: 2000 + Math.random() * 3000, q: 8 }); rainNodes.t = setTimeout(drip, 40 + Math.random() * 120); };
      rainNodes = { n, g, t: null };
      drip();
    } else if (!on && rainNodes) {
      const r = rainNodes; rainNodes = null;
      clearTimeout(r.t);
      r.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1);
      setTimeout(() => { try { r.n.stop(); } catch { /* */ } }, 1200);
    }
  };
  if (rain) setRain(true);

  if (fire) {
    const n = noise(c);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = c.createGain(); g.gain.value = 0.06;
    n.connect(f).connect(g).connect(bus);
    n.start();
    stops.push(() => n.stop());
    const crackle = () => {
      for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) burst({ dur: 0.01 + Math.random() * 0.03, vol: 0.05 + Math.random() * 0.12, freq: 1500 + Math.random() * 4000, q: 1.5, at: i * 0.03 });
      timers.push(setTimeout(crackle, 80 + Math.random() * 450));
    };
    crackle();
  }

  if (birds) {
    // különböző "fajok": dallam-minták, magasság, tempó
    const species = [
      { base: 3200, notes: [0, 4, 7, 4, 9], len: 0.07, gap: 0.05 },
      { base: 2400, notes: [0, -3, -6], len: 0.12, gap: 0.08 },
      { base: 4200, notes: [0, 2, 0, 2, 0, 2], len: 0.04, gap: 0.03 },
      { base: 1800, notes: [0, 5], len: 0.22, gap: 0.12 },
    ];
    const sing = () => {
      const sp = species[Math.floor(Math.random() * species.length)];
      const pan = Math.random() * 1.6 - 0.8;
      const vol = 0.02 + Math.random() * 0.03;
      let t = 0;
      for (const st of sp.notes) {
        const f = sp.base * 2 ** (st / 12) * (0.95 + Math.random() * 0.1);
        tone(f, { dur: sp.len, vol, at: t, attack: 0.01, slide: (Math.random() - 0.3) * f * 0.25, pan });
        t += sp.len + sp.gap;
      }
      timers.push(setTimeout(sing, 700 + Math.random() * 2800));
    };
    timers.push(setTimeout(sing, 300));
  }

  return {
    setRain,
    setVolume: (v) => { bus.gain.value = v; },
    stop: () => {
      timers.forEach(clearTimeout); timers = [];
      setRain(false);
      stops.forEach((s) => { try { s(); } catch { /* */ } });
      setTimeout(() => bus.disconnect(), 1500);
    },
  };
}
