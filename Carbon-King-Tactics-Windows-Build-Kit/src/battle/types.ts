import type { JobAbility, WeaponType } from '../game/jobs';

/** A unit on the battlefield (logic state only; the 3D rig lives in BattleScene). */
export interface BU {
  uid: string; name: string; icon: string; color: string; team: 'player' | 'enemy';
  charId?: string; jobId: string; level: number;
  hp: number; maxHp: number; atk: number; def: number; spd: number; mag: number;
  move: number; jump: number; jobName: string;
  wType: WeaponType; wRange: [number, number]; wName: string; wAtk: number;
  hasShield: boolean; passive: string[]; abilities: JobAbility[];
  x: number; z: number; alive: boolean;
  atkUp: number; defUp: number; defDown: number; shield: number; suit: number;
  tempAtk: number; steady: boolean; marked: number; slow: number;
  tauntUid: string | null; tauntTurns: number;
  weak: string; scanned: boolean; flash: number; moteLife?: number; gutsUsed: boolean;
  /** turn economy: one action (attack / ability / fire) and one move; the turn ends when both are spent */
  acted: boolean; moved: boolean;
}

export type Phase = 'fight' | 'victory' | 'defeat';
export type Panel = 'main' | 'skills' | 'fire';
export interface Floater { id: number; x: number; y: number; text: string; color: string }

export const GUNS: WeaponType[] = ['Pistol', 'SMG', 'Assault', 'LongRifle'];
export const tkey = (x: number, z: number) => `${x},${z}`;
export const parseKey = (k: string): [number, number] => { const [x, z] = k.split(',').map(Number); return [x, z]; };
