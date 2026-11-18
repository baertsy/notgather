// Saját mikrofon, kamera és képernyőmegosztás, eszközválasztás.

const PREFS_KEY = 'ng_media_prefs';

export const prefs = loadPrefs();

function loadPrefs() {
  const d = { micId: '', speakerId: '', camId: '', noiseSuppression: true, echoCancellation: true, autoGain: true, micMuted: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return d; }
}

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* */ }
}

export const local = {
  micStream: null,
  micTrack: null,
  camTrack: null,
  screenTrack: null,
  micError: null,
};

export async function startMic() {
  stopMic();
  const audio = {
    echoCancellation: prefs.echoCancellation,
    noiseSuppression: prefs.noiseSuppression,
    autoGainControl: prefs.autoGain,
    channelCount: 1,
  };
  if (prefs.micId) audio.deviceId = { ideal: prefs.micId };
  try {
    local.micStream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    local.micTrack = local.micStream.getAudioTracks()[0] || null;
    if (local.micTrack) {
      local.micTrack.contentHint = 'speech';
      local.micTrack.enabled = !prefs.micMuted;
    }
    local.micError = null;
  } catch (e) {
    local.micError = e.name || 'error';
    local.micStream = null;
    local.micTrack = null;
  }
  return local.micTrack;
}

export function stopMic() {
  local.micStream?.getTracks().forEach((t) => t.stop());
  local.micStream = null;
  local.micTrack = null;
}

export function setMicMuted(muted) {
  prefs.micMuted = muted;
  savePrefs();
  if (local.micTrack) local.micTrack.enabled = !muted;
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
