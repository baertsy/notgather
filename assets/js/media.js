// Saját mikrofon, kamera és képernyőmegosztás, eszközválasztás.

const PREFS_KEY = 'ng_media_prefs';

export const prefs = loadPrefs();

function loadPrefs() {
  const d = { micId: '', speakerId: '', camId: '', noise: 'rnnoise', echoCancellation: true, autoGain: true, micMuted: false, lowRes: false };
  try {
    const p = { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    if (!['rnnoise', 'browser', 'off'].includes(p.noise)) p.noise = 'rnnoise';
    return p;
  } catch { return d; }
}

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* */ }
}

export const local = {
  rawStream: null,    // a mikrofon nyers hangja
  micStream: null,    // ezt küldjük (zajszűrés után)
  micTrack: null,
  camTrack: null,
  screenTrack: null,
  micError: null,
  noiseActive: false,
  noiseError: null,
};

// ---------------------------------------------------------------- RNNoise zajszűrés
// A szűrő egy AudioWorkletben fut (külön szálon), a fájlok a saját tárhelyről jönnek.

const RN_BASE = new URL('../vendor/rnnoise/', import.meta.url);
const RN_ID = '@sapphi-red/web-noise-suppressor/rnnoise';
let rnWasm = null;
let noise = null; // { ctx, src, node, dst }

async function simdSupported() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch { return false; }
}

async function buildNoiseFilter(rawStream) {
  if (!rnWasm) {
    const file = (await simdSupported()) ? 'rnnoise_simd.wasm' : 'rnnoise.wasm';
    const res = await fetch(new URL(file, RN_BASE));
    if (!res.ok) throw new Error('wasm ' + res.status);
    rnWasm = await res.arrayBuffer();
  }
  // Az RNNoise 48 kHz-en működik.
  const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  await ctx.audioWorklet.addModule(new URL('workletProcessor.js', RN_BASE));
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(rawStream);
  const node = new AudioWorkletNode(ctx, RN_ID, { processorOptions: { maxChannels: 1, wasmBinary: rnWasm.slice(0) } });
  const dst = ctx.createMediaStreamDestination();
  src.connect(node);
  node.connect(dst);
  return { ctx, src, node, dst };
}

function destroyNoiseFilter() {
  if (!noise) return;
  try { noise.src.disconnect(); noise.node.disconnect(); noise.node.port.postMessage('destroy'); } catch { /* */ }
  noise.ctx.close().catch(() => {});
  noise = null;
}

export async function startMic() {
  stopMic();
  const useRn = prefs.noise === 'rnnoise' && typeof AudioWorkletNode !== 'undefined';
  const audio = {
    echoCancellation: prefs.echoCancellation,
    // RNNoise mellett a böngésző saját zajszűrője kikapcsol, hogy ne torzítson a kettő együtt.
    noiseSuppression: prefs.noise === 'browser',
    autoGainControl: prefs.autoGain,
    channelCount: 1,
  };
  if (prefs.micId) audio.deviceId = { ideal: prefs.micId };
  try {
    local.rawStream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    local.micError = null;
  } catch (e) {
    local.micError = e.name || 'error';
    local.rawStream = null;
    local.micStream = null;
    local.micTrack = null;
    return null;
  }
  local.micStream = local.rawStream;
  local.noiseActive = false;
  local.noiseError = null;
  if (useRn) {
    try {
      noise = await buildNoiseFilter(local.rawStream);
      local.micStream = noise.dst.stream;
      local.noiseActive = true;
      if (prefs.micMuted) noise.ctx.suspend().catch(() => {});
    } catch (e) {
      console.warn('RNNoise nem indult el, marad a böngésző zajszűrője', e);
      local.noiseError = String(e?.message || e);
      destroyNoiseFilter();
      // a böngésző szűrőjét bekapcsoljuk helyette
      try { await local.rawStream.getAudioTracks()[0].applyConstraints({ ...audio, noiseSuppression: true }); } catch { /* */ }
    }
  }
  local.micTrack = local.micStream.getAudioTracks()[0] || null;
  if (local.micTrack) {
    local.micTrack.contentHint = 'speech';
    local.micTrack.enabled = !prefs.micMuted;
  }
  return local.micTrack;
}

export function stopMic() {
  destroyNoiseFilter();
  local.rawStream?.getTracks().forEach((t) => t.stop());
  local.micStream?.getTracks().forEach((t) => t.stop());
  local.rawStream = null;
  local.micStream = null;
  local.micTrack = null;
  local.noiseActive = false;
}

export function setMicMuted(muted) {
  prefs.micMuted = muted;
  savePrefs();
  if (local.micTrack) local.micTrack.enabled = !muted;
  // némításkor a szűrőt is pihentetjük, így nem fogyaszt CPU-t
  if (noise) { if (muted) noise.ctx.suspend().catch(() => {}); else noise.ctx.resume().catch(() => {}); }
}

export async function startCam() {
  const video = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
  if (prefs.camId) video.deviceId = { ideal: prefs.camId };
  const s = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  local.camTrack = s.getVideoTracks()[0];
  return local.camTrack;
}

export function stopCam() {
  local.camTrack?.stop();
  local.camTrack = null;
}

export async function startScreen(onEnded) {
  const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10, max: 15 } }, audio: false });
  const t = s.getVideoTracks()[0];
  t.contentHint = 'detail';
  t.addEventListener('ended', () => { if (local.screenTrack === t) { local.screenTrack = null; onEnded?.(); } });
  local.screenTrack = t;
  return t;
}

export function stopScreen() {
  local.screenTrack?.stop();
  local.screenTrack = null;
}

export async function listDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      mics: all.filter((d) => d.kind === 'audioinput'),
      speakers: all.filter((d) => d.kind === 'audiooutput'),
      cams: all.filter((d) => d.kind === 'videoinput'),
    };
  } catch {
    return { mics: [], speakers: [], cams: [] };
  }
}

// --- Hangerő-mérés (ki beszél éppen) ---
let ctx = null;
export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export class LevelMeter {
  constructor(stream) {
    const c = audioContext();
    this.src = c.createMediaStreamSource(stream);
    this.an = c.createAnalyser();
    this.an.fftSize = 512;
    this.buf = new Float32Array(this.an.fftSize);
    this.src.connect(this.an);
  }
  level() {
    this.an.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }
  dispose() {
    try { this.src.disconnect(); this.an.disconnect(); } catch { /* */ }
  }
}
