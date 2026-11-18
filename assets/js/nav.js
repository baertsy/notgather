// Ütközés és útkeresés.
//
// Az avatart a "lábnyoma" képviseli: egy kis téglalap a talppont körül.
// A tömör tárgyak (falak, asztalok, szekrények...) ezt nem engedik át.
// Útkereséshez a térképet 10 px-es rácsra bontjuk, és A*-gal keresünk
// csak vízszintes/függőleges lépésekkel, a fordulásokat kicsit büntetve.

import { CATALOG, itemBox } from './furniture.js';

const CELL = 10;
const FW = 7;     // a lábnyom fél szélessége
const FUP = 6;    // a talppont fölött
const FDOWN = 2;  // a talppont alatt

let rects = [];   // { x1, y1, x2, y2, item, door }
let grid = null;  // Uint8Array: 0 szabad, 1 tömör, 2 ajtó (átjárható, de költségesebb)
let gw = 0, gh = 0, W = 0, H = 0;
let doorAccess = () => 'open';

/**
 * Az akadályok újraépítése.
 * @param {Array} items  a térkép tárgyai
 * @param {{w:number,h:number}} world
 * @param {(item)=>'open'|'closed'|'locked'|'key'} access  ajtók állapota az adott felhasználó szemszögéből
 */
export function build(items, world, access) {
  doorAccess = access;
  W = world.w; H = world.h;
  rects = [];
  for (const it of items) {
    const def = CATALOG[it.type];
    if (!def || (!def.solid && !def.door)) continue;
    const b = itemBox(it);
    rects.push({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h, item: it, door: !!def.door });
  }
  gw = Math.ceil(W / CELL);
  gh = Math.ceil(H / CELL);
  grid = new Uint8Array(gw * gh);
  for (const r of rects) {
    let v = 1;
    if (r.door) {
      const a = doorAccess(r.item);
      v = a === 'locked' ? 1 : 2;
    }
    const cx1 = Math.max(0, Math.floor((r.x1 - FW) / CELL));
    const cx2 = Math.min(gw - 1, Math.ceil((r.x2 + FW) / CELL));
    const cy1 = Math.max(0, Math.floor((r.y1 - FDOWN) / CELL));
    const cy2 = Math.min(gh - 1, Math.ceil((r.y2 + FUP) / CELL));
    for (let cy = cy1; cy <= cy2; cy++) {
      const py = cy * CELL + CELL / 2;
      if (!(py > r.y1 - FDOWN && py < r.y2 + FUP)) continue;
      for (let cx = cx1; cx <= cx2; cx++) {
        const px = cx * CELL + CELL / 2;
        if (!(px > r.x1 - FW && px < r.x2 + FW)) continue;
        const i = cy * gw + cx;
        if (v === 1 || grid[i] === 0) grid[i] = v;
      }
    }
  }
  // a térkép széle
  for (let cx = 0; cx < gw; cx++) { grid[cx] = 1; grid[(gh - 1) * gw + cx] = 1; }
  for (let cy = 0; cy < gh; cy++) { grid[cy * gw] = 1; grid[cy * gw + gw - 1] = 1; }
}

/**
 * Mi akadályozza a talppontot ebben a helyzetben? (null = szabad)
 * A nyitott ajtó, illetve a kulccsal/bentről átjárható zárt ajtó nem akadály.
 */
export function blockerAt(x, y) {
  if (x < FW || y < FUP || x > W - FW || y > H - FDOWN) return { edge: true };
  for (const r of rects) {
    if (x + FW > r.x1 && x - FW < r.x2 && y + FDOWN > r.y1 && y - FUP < r.y2) {
      if (r.door) {
        const a = doorAccess(r.item);
        if (a === 'open' || a === 'key') continue;
      }
      return r;
    }
  }
  return null;
}

export function isFree(x, y) {
  return !blockerAt(x, y);
}

function cellOf(x, y) {
  return [Math.max(0, Math.min(gw - 1, Math.floor(x / CELL))), Math.max(0, Math.min(gh - 1, Math.floor(y / CELL)))];
}
const centerOf = (cx, cy) => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });

/** A legközelebbi szabad pont (pl. ha valaki falba "ragadt"). */
export function nearestFree(x, y, maxR = 40) {
  if (!grid) return { x, y };
  if (isFree(x, y)) return { x, y };
  const [sx, sy] = cellOf(x, y);
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = sx + dx, cy = sy + dy;
        if (cx < 0 || cy < 0 || cx >= gw || cy >= gh || grid[cy * gw + cx] === 1) continue;
        const p = centerOf(cx, cy);
        if (!isFree(p.x, p.y)) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
    }
    if (best) return best;
  }
  return { x, y };
}

// ---------------------------------------------------------------- A*

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= n.f) break; a[i] = a[p]; i = p; } a[i] = n; }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < (m === i ? last.f : a[m].f)) m = l;
        if (r < a.length && a[r].f < (m === i ? last.f : a[m].f)) m = r;
        if (m === i) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  }
  get size() { return this.a.length; }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Útvonal a kezdőpontból a célba. A cél, ha tömör, a legközelebbi szabad pontra módosul.
 * @returns {{x:number,y:number}[] | null} töréspontok (a kezdőpont nélkül)
 */
export function findPath(from, to) {
  if (!grid) return [to];
  const goal = nearestFree(to.x, to.y, 30);
  if (grid[cellOf(from.x, from.y)[1] * gw + cellOf(from.x, from.y)[0]] === 1) from = nearestFree(from.x, from.y);
  const [sx, sy] = cellOf(from.x, from.y);
  const [gx, gy] = cellOf(goal.x, goal.y);
  if (sx === gx && sy === gy) return [goal];
  const N = gw * gh;
  const g = new Float32Array(N * 4).fill(Infinity);
  const parent = new Int32Array(N * 4).fill(-1);
  const closed = new Uint8Array(N * 4);
  const heap = new Heap();
  const h = (cx, cy) => Math.abs(cx - gx) + Math.abs(cy - gy);
  const start = sy * gw + sx;
  for (let d = 0; d < 4; d++) { g[start * 4 + d] = 0; heap.push({ s: start * 4 + d, f: h(sx, sy) }); }
  let found = -1, iter = 0;
  while (heap.size && iter++ < 200000) {
    const { s } = heap.pop();
    if (closed[s]) continue;
    closed[s] = 1;
    const cell = s >> 2, dir = s & 3;
    const cx = cell % gw, cy = (cell / gw) | 0;
    if (cx === gx && cy === gy) { found = s; break; }
    for (let nd = 0; nd < 4; nd++) {
      const nx = cx + DIRS[nd][0], ny = cy + DIRS[nd][1];
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const nc = ny * gw + nx;
      const v = grid[nc];
      if (v === 1) continue;
      const cost = (v === 2 ? 3 : 1) + (nd !== dir ? 0.6 : 0);
      const ns = nc * 4 + nd;
      const ng = g[s] + cost;
      if (ng < g[ns]) {
        g[ns] = ng;
        parent[ns] = s;
        heap.push({ s: ns, f: ng + h(nx, ny) });
      }
    }
  }
  if (found < 0) return null;
  // visszafejtés, csak a töréspontokat tartjuk meg
  const cells = [];
  for (let s = found; s >= 0; s = parent[s]) cells.push(s);
  cells.reverse();
  const pts = [];
  for (let i = 1; i < cells.length; i++) {
    const c = cells[i] >> 2;
    const next = cells[i + 1];
    if (next === undefined || (next & 3) !== (cells[i] & 3)) pts.push(centerOf(c % gw, (c / gw) | 0));
  }
  // utolsó lépés pontosan a célba, ha az szabad
  if (isFree(goal.x, goal.y)) pts.push(goal);
  // a kezdőponthoz igazítás: az első szakasz tengelyirányú legyen
  if (pts.length) {
    const first = pts[0];
    const dx = Math.abs(first.x - from.x), dy = Math.abs(first.y - from.y);
    if (dx > 0.5 && dy > 0.5) pts.unshift(dx < dy ? { x: first.x, y: from.y } : { x: from.x, y: first.y });
  }
  return pts;
}

/** Elérhető-e egy pont? (teszteléshez és interakcióhoz) */
export function reachable(from, to) {
  return !!findPath(from, to);
}

export const NAV = { CELL, FW, FUP, FDOWN };
