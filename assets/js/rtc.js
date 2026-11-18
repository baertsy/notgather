// WebRTC kapcsolatkezelő.
//
// Mindenki mindenkivel egy kapcsolatot tart fenn (11 főnél ez kevés). Minden
// kapcsolatban fix 3 média-sáv van: hang, kamera, képernyő, plusz egy
// adatcsatorna. A sávokat soha nem tárgyaljuk újra: hogy kinek mit küldünk,
// azt csak a sávba tett hang/kép cseréje dönti el (replaceTrack). Így nincs
// újratárgyalás, nincs ütközés, és a szobaváltás azonnali.
//
// A kapcsolatot mindig a kisebb peerId-jű fél kezdeményezi. A kapcsolatfelépítés
// üzenetei (offer/answer) a PHP-n át mennek, egyben, az ICE jelöltekkel együtt,
// így egy kapcsolathoz összesen 2 üzenet kell.

const SLOTS = ['audio', 'cam', 'screen'];
const ICE_WAIT_MS = 2500;
const ANSWER_TIMEOUT_MS = 15000;
const DISCONNECT_GRACE_MS = 8000;

function waitForIce(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(t); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const t = setTimeout(done, ICE_WAIT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

class Peer {
  constructor(mgr, peerId, userId) {
    this.mgr = mgr;
    this.peerId = peerId;
    this.userId = userId;
    this.initiator = mgr.peerId < peerId;
    this.pc = null;
    this.dc = null;
    this.epoch = null;
    this.tx = {};           // slot -> RTCRtpTransceiver
    this.sent = {};         // slot -> az éppen küldött track (vagy null)
    this.remote = {};       // slot -> MediaStreamTrack
    this.state = 'new';
    this.attempt = 0;
    this.timers = new Set();
    this.closed = false;
  }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
    return t;
  }

  clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.mgr.onPeerState(this, s);
  }

  start() {
    if (this.initiator) this.connect();
    else {
      // A másik fél kezdeményez. Ha sokáig nem jön ajánlat, megkérjük rá.
      this.later(() => { if (!this.pc && !this.closed) this.mgr.signal(this, { type: 'restart' }); }, 6000);
    }
  }

  buildPc() {
    this.teardownPc();
    const pc = new RTCPeerConnection({ iceServers: this.mgr.iceServers, bundlePolicy: 'max-bundle' });
    this.pc = pc;
    this.tx = {};
    this.sent = {};
    const dc = pc.createDataChannel('ng', { negotiated: true, id: 0, ordered: true });
    this.dc = dc;
    dc.onopen = () => { this.attempt = 0; this.mgr.onChannelOpen(this); };
    dc.onclose = () => this.mgr.onChannelClose(this);
    dc.onmessage = (e) => {
      let msg = null;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.mgr.onData(this, msg);
    };
    pc.ontrack = (e) => {
      const slot = SLOTS[Number(e.transceiver?.mid)];
      if (!slot) return;
      this.remote[slot] = e.track;
      this.mgr.onRemoteTrack(this, slot, e.track);
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.setState('connected');
        this.mgr.applyTracks(this);
      } else if (s === 'failed') {
        this.fail();
      } else if (s === 'disconnected') {
        // Rövid kiesés (pl. wifi-váltás) után gyakran magától helyreáll.
        this.later(() => { if (pc === this.pc && pc.connectionState === 'disconnected') this.fail(); }, DISCONNECT_GRACE_MS);
      }
    };
    return pc;
  }

  async connect() {
    if (this.closed) return;
    this.clearTimers();
    this.setState('connecting');
    const pc = this.buildPc();
    for (const slot of SLOTS) {
      this.tx[slot] = pc.addTransceiver(slot === 'audio' ? 'audio' : 'video', { direction: 'sendrecv' });
    }
    this.mgr.applyTracks(this);
    const epoch = Math.random().toString(36).slice(2, 10);
    this.epoch = epoch;
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIce(pc);
      if (pc !== this.pc) return;
      this.mgr.signal(this, { type: 'offer', epoch, sdp: pc.localDescription.sdp });
      this.later(() => { if (pc === this.pc && this.state !== 'connected') this.fail(); }, ANSWER_TIMEOUT_MS);
    } catch (e) {
      console.warn('offer hiba', e);
      this.fail();
    }
  }

  async handleOffer(data) {
    if (this.closed) return;
    this.clearTimers();
    this.setState('connecting');
    const pc = this.buildPc();
    this.epoch = data.epoch;
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      for (const t of pc.getTransceivers()) {
        const slot = SLOTS[Number(t.mid)];
        if (!slot) continue;
        t.direction = 'sendrecv';
        this.tx[slot] = t;
      }
      this.mgr.applyTracks(this);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIce(pc);
      if (pc !== this.pc) return;
      this.mgr.signal(this, { type: 'answer', epoch: data.epoch, sdp: pc.localDescription.sdp });
      this.later(() => { if (pc === this.pc && this.state !== 'connected') this.fail(); }, ANSWER_TIMEOUT_MS + 5000);
    } catch (e) {
      console.warn('answer hiba', e);
      this.fail();
    }
  }

  async handleAnswer(data) {
    const pc = this.pc;
    if (!pc || data.epoch !== this.epoch || pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
    } catch (e) {
      console.warn('answer feldolgozási hiba', e);
      this.fail();
    }
  }

  // Sikertelen kapcsolat: lebontjuk és fokozatosan ritkuló próbálkozással újrakezdjük.
  fail() {
    if (this.closed) return;
    this.clearTimers();
    this.teardownPc();
    this.setState('failed');
    this.attempt++;
    const delay = Math.min(30000, 1500 * 2 ** Math.min(this.attempt - 1, 5)) + Math.random() * 1000;
    if (this.initiator) this.later(() => this.connect(), delay);
    else this.later(() => { if (!this.pc) this.mgr.signal(this, { type: 'restart' }); }, delay);
  }

  teardownPc() {
    if (this.dc) { this.dc.onclose = null; try { this.dc.close(); } catch { /* */ } }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      try { this.pc.close(); } catch { /* */ }
    }
    const hadRemote = Object.keys(this.remote).length > 0;
    this.pc = null;
    this.dc = null;
    this.tx = {};
    this.sent = {};
    this.remote = {};
    if (hadRemote) this.mgr.onRemoteGone(this);
  }

  send(msg) {
    if (this.dc?.readyState === 'open') {
      try { this.dc.send(JSON.stringify(msg)); return true; } catch { /* */ }
    }
    return false;
  }

  get open() {
    return this.dc?.readyState === 'open';
  }

  close() {
    this.closed = true;
    this.clearTimers();
    this.teardownPc();
  }
}

export class PeerManager {
  /**
   * @param {object} o
   * @param {string} o.peerId saját azonosító
   * @param {RTCIceServer[]} o.iceServers
   * @param {(peerId:string, data:object)=>void} o.sendSignal jelzés küldése PHP-n át
   * @param {(userId:number)=>{audio:boolean, video:boolean}} o.policy kinek mit küldünk
   * @param {()=>{audio:MediaStreamTrack|null, cam:MediaStreamTrack|null, screen:MediaStreamTrack|null}} o.localTracks
   */
  constructor(o) {
    Object.assign(this, o);
    this.peers = new Map(); // peerId -> Peer
  }

  peerByUser(userId) {
    for (const p of this.peers.values()) if (p.userId === userId) return p;
    return null;
  }

  // Az online felhasználók listája alapján kapcsolatok nyitása/zárása.
  syncRoster(list) {
    const want = new Map(list.filter((u) => u.peerId && u.peerId !== this.peerId).map((u) => [u.peerId, u.id]));
    for (const [pid, peer] of this.peers) {
      if (!want.has(pid)) this.drop(pid);
      else if (want.get(pid) !== peer.userId) this.drop(pid);
    }
    for (const [pid, userId] of want) {
      if (!this.peers.has(pid)) {
        // Ugyanannak a usernek egy régebbi ablaka? Azt lezárjuk.
        const old = this.peerByUser(userId);
        if (old) this.drop(old.peerId);
        const peer = new Peer(this, pid, userId);
        this.peers.set(pid, peer);
        peer.start();
      }
    }
  }

  drop(pid) {
    const p = this.peers.get(pid);
    if (!p) return;
    this.peers.delete(pid);
    p.close();
    this.onPeerState(p, 'closed');
  }

  handleSignal(fromPeer, fromUser, data) {
    if (!data || typeof data !== 'object') return;
    let peer = this.peers.get(fromPeer);
    if (!peer) {
      // Még nem látjuk a névsorban (a jelenlét késik): ettől még fogadjuk.
      const old = this.peerByUser(fromUser);
      if (old) this.drop(old.peerId);
      peer = new Peer(this, fromPeer, fromUser);
      this.peers.set(fromPeer, peer);
    }
    if (data.type === 'offer' && !peer.initiator) peer.handleOffer(data);
    else if (data.type === 'answer' && peer.initiator) peer.handleAnswer(data);
    else if (data.type === 'restart' && peer.initiator) {
      if (peer.state !== 'connected' || !peer.open) peer.connect();
    }
  }

  signal(peer, data) {
    this.sendSignal(peer.peerId, data);
  }

  // Eldönti, hogy az adott kapcsolatban mit küldjünk, és csak a változást alkalmazza.
  applyTracks(peer) {
    if (!peer.pc) return;
    const want = this.policy(peer.userId);
    const local = this.localTracks();
    const target = {
      audio: want.audio ? local.audio : null,
      cam: want.video ? local.cam : null,
      screen: want.video ? local.screen : null,
    };
    for (const slot of SLOTS) {
      const t = peer.tx[slot];
      if (!t) continue;
      const track = target[slot] || null;
      if (peer.sent[slot] === track) continue;
      peer.sent[slot] = track;
      t.sender.replaceTrack(track).catch((e) => console.warn('replaceTrack', e));
      if (track && slot !== 'audio') this.limitBitrate(t.sender, slot === 'screen' ? 1500000 : 600000);
    }
  }

  async limitBitrate(sender, max) {
    try {
      const p = sender.getParameters();
      if (!p.encodings || !p.encodings.length) return;
      if (p.encodings[0].maxBitrate === max) return;
      p.encodings[0].maxBitrate = max;
      await sender.setParameters(p);
    } catch { /* nem minden állapotban állítható, nem kritikus */ }
  }

  refreshAll() {
    for (const p of this.peers.values()) this.applyTracks(p);
  }

  broadcast(msg) {
    for (const p of this.peers.values()) p.send(msg);
  }

  sendToUser(userId, msg) {
    return this.peerByUser(userId)?.send(msg) || false;
  }

  isOpenTo(userId) {
    return !!this.peerByUser(userId)?.open;
  }

  // Van-e még folyamatban lévő kapcsolatfelépítés? (ilyenkor gyorsabban szinkronizálunk)
  get busy() {
    // Tartósan sikertelen kapcsolat (pl. TURN nélkül) ne pörgesse a szervert.
    for (const p of this.peers.values()) if (!p.open && p.attempt < 3) return true;
    return false;
  }

  closeAll() {
    for (const pid of [...this.peers.keys()]) this.drop(pid);
  }
}
