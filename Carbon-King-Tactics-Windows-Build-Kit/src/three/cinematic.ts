import * as THREE from 'three';
import type { BattleMap } from '../game/terrain';
import type { WeaponType } from '../game/jobs';
import { lerpAngle } from '../lib/rng';
import { gx, topYOf } from './kit';
import { buildCharacter, updateRig, type CharRig, type Species } from './characters';
import type { StageKit } from './stage';

/** Story-cast definitions + placement/animation helpers shared by the story scenes and the title screen. */

interface CastDef {
  color: string; species: Species; jobId: string; wType: WeaponType | null;
  hat?: 'cowboy' | null; side: 'party' | 'other'; icon: string; enemy?: boolean;
}

export const CAST: Record<string, CastDef> = {
  RYE: { color: '#facc15', species: 'canine', jobId: 'drifter', wType: 'Sword', side: 'party', icon: 'dog' },
  JUNE: { color: '#f472b6', species: 'human', jobId: 'surgeon', wType: 'Mace', side: 'party', icon: 'heartpulse' },
  SEVEN: { color: '#5eead4', species: 'synth', jobId: 'echo-vessel', wType: 'DEW', side: 'party', icon: 'orbit' },
  MAYA: { color: '#93c5fd', species: 'human', jobId: 'ghost-signal', wType: 'SMG', side: 'party', icon: 'terminal' },
  SILAS: { color: '#fb923c', species: 'human', jobId: 'warden', wType: 'Assault', hat: 'cowboy', side: 'party', icon: 'coins' },
  VOSS: { color: '#f87171', species: 'human', jobId: 'carbon-knight', wType: 'Mace', side: 'other', icon: 'flame', enemy: true },
  IMOGEN: { color: '#c084fc', species: 'human', jobId: 'carbon-king', wType: 'Pistol', side: 'other', icon: 'star' },
  CHOIR: { color: '#22d3ee', species: 'synth', jobId: 'echo-vessel', wType: null, side: 'other', icon: 'eye' },
};

interface CastMember { rig: CharRig; def: CastDef; face: number }

const PARTY_SLOTS: [number, number][] = [[2, 4], [2, 6], [1, 5], [3, 3], [1, 3]];
const OTHER_SLOTS: [number, number][] = [[7, 4], [6, 6], [6, 3]];

export function spawnCast(kit: StageKit, bmap: BattleMap, whos: string[], layout: 'story' | 'line' = 'story'): Map<string, CastMember> {
  const out = new Map<string, CastMember>();
  const { heights, blocked } = bmap;
  const open = (sx: number, sz: number): [number, number] => {
    if (!blocked[sx][sz]) return [sx, sz];
    for (let r = 1; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const nx = sx + dx, nz = sz + dz;
      if (nx >= 0 && nz >= 0 && nx < 9 && nz < 9 && !blocked[nx][nz]) return [nx, nz];
    }
    return [4, 4];
  };
  let pi = 0, oi = 0;
  const list = whos.filter(w => CAST[w]).slice(0, 8);
  list.forEach((who, i) => {
    const def = CAST[who];
    let x: number, z: number, face: number;
    if (layout === 'line') {
      const fx = 4 + (i - (list.length - 1) / 2) * 1.25;
      [x, z] = open(Math.round(fx), 6);
      face = 0.15 * (i - (list.length - 1) / 2) * -1;
    } else {
      const slot = def.side === 'party' ? PARTY_SLOTS[pi++ % PARTY_SLOTS.length] : OTHER_SLOTS[oi++ % OTHER_SLOTS.length];
      [x, z] = open(slot[0], slot[1]);
      face = def.side === 'party' ? Math.PI / 2 : -Math.PI / 2;
    }
    const rig = buildCharacter({ uid: 'story-' + who, team: def.enemy ? 'enemy' : 'player', color: def.color, species: def.species, jobId: def.jobId, wType: def.wType, hasShield: false, hat: def.hat ?? null });
    rig.ring.visible = false;
    rig.root.position.set(layout === 'line' ? gx(4 + (i - (list.length - 1) / 2) * 1.25) : gx(x), topYOf(heights, x, z), gx(z));
    rig.root.rotation.y = face;
    kit.scene.add(rig.root);
    out.set(who, { rig, def, face });
  });
  return out;
}

export function animateCast(cast: Map<string, CastMember>, t: number, dt: number, now: number, speaking: string, camera: THREE.Camera) {
  cast.forEach((m, who) => {
    const sp = who === speaking;
    m.rig.anim.excited = sp ? 1 : 0;
    updateRig(m.rig, t, dt, now);
    m.rig.body.position.y += sp ? Math.abs(Math.sin(t * 7)) * 0.06 : 0;
    const want = sp ? Math.atan2(camera.position.x - m.rig.root.position.x, camera.position.z - m.rig.root.position.z) : m.face;
    m.rig.root.rotation.y = lerpAngle(m.rig.root.rotation.y, want, 0.08);
  });
}
