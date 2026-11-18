// Az alkalmazás közös állapota és egy egyszerű eseménykezelő.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  for (const fn of listeners.get(event) || []) {
    try { fn(payload); } catch (e) { console.error(`[${event}]`, e); }
  }
}

export const S = {
  me: null,          // { id, username, name, color, emoji, isAdmin }
  peerId: null,      // ennek a böngészőablaknak az egyedi azonosítója
  appName: 'NotGather',
  iceServers: [],
  world: { w: 1600, h: 1000, version: 1 },
  zones: [],
  items: [],         // bútorok

  // A saját élő állapotom, amit a többiek látnak.
  local: { x: 200, y: 200, zone: null, status: 'available', mic: true, cam: false, screen: false, call: null },

  // A többiek: userId -> { id, name, color, emoji, online, peerId, x, y, zone, status, mic, cam, screen, call }
  users: new Map(),

  // Kapcsolat állapota userId szerint: 'connecting' | 'connected' | 'failed'
  conn: new Map(),

  messages: [],      // időrendben
  msgIds: new Set(),
  lastMsgId: 0,
  unread: new Map(), // beszélgetés kulcs -> darab
};

// A saját állapotom "felhasználó" formában (a hallhatósági szabályhoz).
export function meAsUser() {
  return { id: S.me.id, ...S.local };
}

export function zoneById(id) {
  return S.zones.find((z) => z.id === id) || null;
}

// Melyik szobában van egy pont? Egymásba ágyazott szobáknál a kisebb nyer.
export function zoneAt(x, y) {
  let best = null;
  for (const z of S.zones) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
      if (!best || z.w * z.h < best.w * best.h) best = z;
    }
  }
  return best;
}

/**
 * Hallja-e egymást két ember? Ez a szabály mindkét oldalon ugyanúgy fut,
 * így mindenki pontosan annak küld hangot, aki hallhatja.
 *  - Közvetlen hívásban csak a hívó felek hallják egymást.
 *  - Egyébként ugyanabban a beszélgetős szobában kell lenni.
 *  - Nyitott térben és csendes szobában senki nem hall senkit.
 *  - "Elfoglalt" állapotban szobán belül sem.
 */
export function audible(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.call || b.call) return a.call === b.id && b.call === a.id;
  if (a.status === 'busy' || b.status === 'busy') return false;
  if (a.zone == null || a.zone !== b.zone) return false;
  const z = zoneById(a.zone);
  return !!z && z.kind !== 'quiet';
}

export function convKeyOf(msg, myId) {
  if (msg.scope === 'global') return 'g';
  if (msg.scope === 'zone') return 'z:' + msg.targetId;
  return 'd:' + (msg.senderId === myId ? msg.targetId : msg.senderId);
}
