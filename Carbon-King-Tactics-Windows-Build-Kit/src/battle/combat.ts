import { manhattan } from '../lib/rng';
import { GUNS, type BU } from './types';

/** Pure combat math. No React, no three.js. */

export function effDef(u: BU, all: BU[]): number {
  let d = u.def + (u.defUp > 0 ? 4 : 0) - (u.defDown > 0 ? 3 : 0) + (u.suit > 0 ? 2 : 0);
  if (u.passive.includes('phalanx')) {
    const adj = all.filter(v => v.alive && v.team === u.team && v.uid !== u.uid && manhattan(v.x, v.z, u.x, u.z) === 1).length;
    d += Math.min(3, adj);
  }
  return Math.max(0, d);
}

export function weakHit(a: BU, t: BU, isFlash: boolean): boolean {
  if (!t.scanned) return false;
  if (t.weak === 'energy' && (isFlash || a.wType === 'DEW')) return true;
  if (t.weak === 'ballistic' && GUNS.includes(a.wType)) return true;
  if (t.weak === 'blunt' && a.wType === 'Mace') return true;
  if (t.weak === 'pierce' && (a.wType === 'Spear' || a.wType === 'Sword')) return true;
  return false;
}

function atkMult(a: BU, round: number): number {
  let m = (a.atkUp > 0 ? 1.25 : 1) * (a.suit > 0 ? 1.1 : 1);
  if (round === 1 && a.passive.includes('quickdraw')) m *= 1.2;
  return m;
}

export function dmgCalc(heights: number[][], round: number, a: BU, t: BU, mult: number, base: number, isFlash: boolean, all: BU[]): number {
  const hAdv = Math.max(0, heights[a.x][a.z] - heights[t.x][t.z]);
  let d = (base + (isFlash ? 6 : a.wAtk * 0.4)) * mult * atkMult(a, round) - effDef(t, all) * 0.65 + hAdv * 3;
  if (t.marked > 0) d *= 1.3;
  if (weakHit(a, t, isFlash)) d *= 1.5;
  if (a.tempAtk > 0) d += a.tempAtk;
  if (a.steady) d *= 1.5;
  return Math.max(1, Math.round(d));
}

/** Shield absorbs first; "guts" passive survives one lethal hit at 1 HP. */
export function applyDamage(u: BU, raw: number): BU {
  if (!u.alive) return u;
  let left = raw, shield = u.shield;
  if (shield > 0) { const ab = Math.min(shield, left); shield -= ab; left -= ab; }
  let hp = u.hp - left, alive = hp > 0, gutsUsed = u.gutsUsed;
  if (!alive && u.passive.includes('guts') && !u.gutsUsed) { hp = 1; alive = true; gutsUsed = true; }
  return { ...u, hp: Math.max(0, hp), shield, alive, gutsUsed };
}

export function counterDamage(target: BU, attacker: BU, all: BU[]): number {
  return Math.max(1, Math.round((target.atk + target.wAtk) * 0.7 - effDef(attacker, all) * 0.5));
}

export function strikeDamage(a: BU, u: BU, all: BU[], air: boolean): number {
  let dmg = Math.max(1, Math.round((a.atk + 12) * (air ? 2.6 : 2.0) - effDef(u, all) * 0.5));
  if (u.marked > 0) dmg = Math.round(dmg * 1.3);
  return dmg;
}

export function enemyDamage(heights: number[][], me: BU, victim: BU, all: BU[]): number {
  const hAdv = Math.max(0, heights[me.x][me.z] - heights[victim.x][victim.z]);
  return Math.max(1, Math.round((me.atk + me.wAtk) - effDef(victim, all) * 0.6 + hAdv * 2));
}
