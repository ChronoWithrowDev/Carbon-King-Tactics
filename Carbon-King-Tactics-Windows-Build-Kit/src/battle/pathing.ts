import { SIZE } from '../game/terrain';
import { manhattan } from '../lib/rng';
import { tkey, parseKey, type BU } from './types';

/** Grid pathing + enemy movement choice. Pure functions over a small context. */

export interface PathCtx {
  heights: number[][];
  isBlocked(x: number, z: number): boolean;
  occAt(x: number, z: number): BU | undefined;
}
export interface Reach { start: string; cost: Map<string, number>; prev: Map<string, string> }

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function computeReach(ctx: PathCtx, u: BU): Reach {
  const start = tkey(u.x, u.z);
  const cost = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const q: [number, number][] = [[u.x, u.z]];
  const maxSteps = Math.max(1, u.move + (u.suit > 0 ? 1 : 0) - (u.slow > 0 ? 1 : 0));
  while (q.length) {
    const [x, z] = q.shift()!;
    const d = cost.get(tkey(x, z))!;
    if (d >= maxSteps) continue;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE || ctx.isBlocked(nx, nz)) continue;
      if (Math.abs(ctx.heights[nx][nz] - ctx.heights[x][z]) > u.jump) continue;
      const o = ctx.occAt(nx, nz);
      if (o && o.team !== u.team) continue;
      const k = tkey(nx, nz);
      if (!cost.has(k)) { cost.set(k, d + 1); prev.set(k, tkey(x, z)); q.push([nx, nz]); }
    }
  }
  return { start, cost, prev };
}

/** Standable destinations (reachable, not the start tile, unoccupied). */
export function destinations(ctx: PathCtx, r: Reach): string[] {
  return [...r.cost.keys()].filter(k => { if (k === r.start) return false; const [x, z] = parseKey(k); return !ctx.occAt(x, z); });
}

export function pathTo(r: Reach, dest: string): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  let k: string | undefined = dest;
  while (k && k !== r.start) { const [x, z] = parseKey(k); out.unshift({ x, z }); k = r.prev.get(k); }
  return out;
}

export function ringTiles(u: BU, min: number, max: number): string[] {
  const out: string[] = [];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const d = manhattan(u.x, u.z, x, z);
    if (d >= min && d <= max) out.push(tkey(x, z));
  }
  return out;
}

interface EnemyPlan { dest: { x: number; z: number }; path: { x: number; z: number }[]; target: BU }

/** Pick a target, then the best reachable tile: shoot from height at max range if possible, otherwise close the distance. */
export function chooseEnemyMove(ctx: PathCtx, u: BU, foes: BU[]): EnemyPlan | null {
  if (!foes.length) return null;
  let target = foes[0], best = 1e9;
  for (const f of foes) { const d = manhattan(u.x, u.z, f.x, f.z); if (d < best) { best = d; target = f; } }
  if (u.tauntUid && u.tauntTurns > 0) {
    const t = foes.find(f => f.uid === u.tauntUid);
    if (t && manhattan(u.x, u.z, t.x, t.z) <= u.move + u.wRange[1] + 2) target = t;
  }
  const reach = computeReach(ctx, u);
  const cands = [u.x + ',' + u.z, ...destinations(ctx, reach)];
  const ranged = u.wRange[1] > 1;
  let bestKey = cands[0], bestScore = -1e9;
  for (const k of cands) {
    const [x, z] = parseKey(k);
    const inRange = foes.filter(f => { const d = manhattan(x, z, f.x, f.z); return d >= u.wRange[0] && d <= u.wRange[1]; });
    const dT = manhattan(x, z, target.x, target.z);
    let score = ctx.heights[x][z] * 4;
    if (inRange.length) {
      score += 200 + (inRange.some(f => f.uid === target.uid) ? 30 : 0) - Math.min(...inRange.map(f => f.hp)) * 0.2;
      score += ranged ? dT * 3 : -dT * 3;   // ranged units kite to max range
    } else score -= dT * 10;
    if (score > bestScore) { bestScore = score; bestKey = k; }
  }
  const [dx, dz] = parseKey(bestKey);
  return { dest: { x: dx, z: dz }, path: bestKey === u.x + ',' + u.z ? [] : pathTo(reach, bestKey), target };
}
