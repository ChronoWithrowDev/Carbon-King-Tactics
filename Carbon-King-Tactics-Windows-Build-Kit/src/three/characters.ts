import * as THREE from 'three';
import type { WeaponType } from '../game/jobs';
import { clamp, hashStr, lerp } from '../lib/rng';
import { G, mat, basic, share, type MatOpts } from './kit';
import { buildWeapon } from './weapons';
import { blobTexture } from './textures';

/**
 * Heroic low-poly character rig: boots, legs (hip+knee pivots), pelvis, torso, clavicles, upper/lower arms,
 * hands, neck, head, hair/helmet, job armor kit, weapon parented to the right hand.
 * Static sub-meshes inside bones have matrixAutoUpdate=false; only bone Groups animate per frame.
 */

export type Species = 'human' | 'canine' | 'synth';
interface CharSpec {
  uid: string; team: 'player' | 'enemy'; color: string; species: Species;
  jobId: string; wType: WeaponType | null; hasShield: boolean; hat?: 'cowboy' | null;
}
type SwingKind = '' | 'melee' | 'thrust' | 'slam' | 'leap' | 'gun' | 'cast';
interface RigPart { mesh: THREE.Mesh; mat: THREE.Material }

export interface CharRig {
  root: THREE.Group; body: THREE.Group; pelvis: THREE.Group; torso: THREE.Group; head: THREE.Group;
  shL: THREE.Group; shR: THREE.Group; elL: THREE.Group; elR: THREE.Group; handR: THREE.Group;
  hipL: THREE.Group; hipR: THREE.Group; kneeL: THREE.Group; kneeR: THREE.Group;
  tail: THREE.Group | null; halo: THREE.Mesh; ring: THREE.Mesh; shadow: THREE.Mesh; bubble: THREE.Mesh; shell: THREE.Mesh;
  muzzle: THREE.Object3D; twoHanded: boolean; parts: RigPart[]; fadeMats: THREE.Material[];
  walkBlend: number; flashing: boolean; castE: number;
  anim: {
    moving: boolean; walkPhase: number; phase: number; hopT0: number; hopDur: number;
    swingKind: SwingKind; swingT0: number; swingDur: number; burst: number;
    hitT0: number; hitDx: number; hitDz: number; blockUntil: number; freezeUntil: number;
    guard: boolean; aim: boolean; victory: boolean;
    deadT0: number; dead: boolean; flashUntil: number; excited: number;
  };
  spec: CharSpec;
}

const flashMat = share(new THREE.MeshBasicMaterial({ color: 0xffffff }));
export const ringMats = {
  player: basic(0x2de2d0, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  enemy: basic(0xff4d5e, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  active: basic(0xffd24a, { transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }),
};
let blobMat: THREE.MeshBasicMaterial | null = null;
const SKINS = [0xf3cba5, 0xc68642, 0x8d5524, 0xffdbac, 0xd6a87c];
const HAIRS = [0x2b2b2b, 0x5a3a1a, 0x8a8a8a, 0xd9c07a, 0x7a2f2f];

export function speciesFor(charId?: string, icon?: string): Species {
  if (charId === 'rye' || icon === 'dog') return 'canine';
  if (charId === 'echo' || icon === 'bot' || icon === 'ghost' || icon === 'orbit' || icon === 'sparkles' || icon === 'moon') return 'synth';
  return 'human';
}
export function hatFor(charId?: string, icon?: string): 'cowboy' | null {
  return charId === 'silas' || icon === 'coins' ? 'cowboy' : null;
}

type V3 = [number, number, number];
type Put = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, p?: V3, r?: V3, s?: V3) => THREE.Mesh;
interface Mats { cloth: THREE.Material; cloth2: THREE.Material; pants: THREE.Material; boots: THREE.Material; skin: THREE.Material; trim: THREE.Material; metal: THREE.Material; dark: THREE.Material; acc: THREE.Material; white: THREE.Material; black: THREE.Material; red: THREE.Material }
interface Kit { put: Put; M: Mats; torso: THREE.Group; head: THREE.Group; pelvis: THREE.Group; enemy: boolean; dog: boolean; synth: boolean; flags: { helmet: boolean; hood: boolean } }

/* ------------------------------ job armor kits ------------------------------ */

const pads = (k: Kit, r = 0.115) => { for (const s of [-1, 1]) k.put(k.torso, G.sph(r, 8, 6), k.M.metal, [0.27 * s, 0.43, 0], undefined, [1, 0.7, 1.1]); };
const helmet = (k: Kit, crest = false) => {
  if (k.dog || k.synth) return;
  k.flags.helmet = true;
  k.put(k.head, G.sph(0.19, 14, 10), k.M.metal, [0, 0.035, -0.01], undefined, [1, 0.92, 1.04]);
  k.put(k.head, G.box(0.23, 0.055, 0.06), k.M.acc, [0, 0.01, 0.16]);
  if (crest) k.put(k.head, G.box(0.04, 0.14, 0.26), k.M.trim, [0, 0.2, -0.02]);
};
const vest = (k: Kit) => {
  k.put(k.torso, G.box(0.37, 0.3, 0.23), k.M.dark, [0, 0.27, 0]);
  for (const x of [-0.11, 0.11]) k.put(k.torso, G.box(0.09, 0.09, 0.05), k.M.trim, [x, 0.2, 0.14]);
};
const pack = (k: Kit) => {
  k.put(k.torso, G.box(0.26, 0.3, 0.12), k.M.cloth2, [0, 0.28, -0.17]);
  k.put(k.torso, G.cyl(0.05, 0.05, 0.3, 8), k.M.dark, [0, 0.46, -0.17], [0, 0, Math.PI / 2]);
};
const collarChip = (k: Kit) => k.put(k.torso, G.box(0.1, 0.07, 0.04), k.M.acc, [0, 0.47, 0.11]);

const KITS: Record<string, (k: Kit) => void> = {
  drifter: k => {
    k.put(k.torso, G.torus(0.1, 0.035, 6, 14), k.M.red, [0, 0.5, 0.01], [Math.PI / 2, 0, 0]); pack(k);
    if (!k.dog && !k.synth) { k.put(k.head, G.cyl(0.17, 0.18, 0.07, 12), k.M.cloth2, [0, 0.13, 0]); k.put(k.head, G.box(0.2, 0.02, 0.12), k.M.cloth2, [0, 0.11, 0.17]); k.flags.hood = true; }
  },
  'carbon-knight': k => {
    k.put(k.torso, G.box(0.37, 0.27, 0.21), k.M.metal, [0, 0.28, 0.01]); k.put(k.torso, G.box(0.28, 0.1, 0.04), k.M.trim, [0, 0.31, 0.12]);
    pads(k, 0.125);
    for (const x of [-0.1, 0.1]) k.put(k.pelvis, G.box(0.12, 0.2, 0.04), k.M.metal, [x, -0.1, 0.12]);
    helmet(k);
  },
  lancer: k => {
    k.put(k.torso, G.box(0.35, 0.22, 0.2), k.M.metal, [0, 0.28, 0.01]); pads(k, 0.1); helmet(k, true);
    k.put(k.pelvis, G.box(0.16, 0.34, 0.02), k.M.trim, [0, -0.15, 0.125]);
  },
  gunner: k => {
    vest(k);
    if (!k.dog && !k.synth) {
      k.put(k.head, G.cyl(0.17, 0.18, 0.07, 12), k.M.cloth, [0, 0.13, 0]); k.put(k.head, G.box(0.2, 0.02, 0.12), k.M.cloth, [0, 0.11, 0.17]);
      k.put(k.head, G.box(0.2, 0.05, 0.05), k.M.acc, [0, 0.06, 0.15]); k.flags.hood = true;
    }
  },
  rifleman: k => { vest(k); pack(k); pads(k, 0.1); helmet(k); },
  deadeye: k => {
    k.flags.hood = true;
    if (!k.dog) k.put(k.head, G.sph(0.2, 12, 10), k.M.cloth2, [0, 0.03, -0.02], undefined, [1, 1, 1.05]);
    k.put(k.torso, G.cone(1, 1, 6), k.M.cloth2, [0, 0.12, -0.13], undefined, [0.3, 0.75, 0.2]);
    k.put(k.head, G.box(0.05, 0.02, 0.03), k.M.acc, [0.1, 0.04, 0.17]);
  },
  'flash-adept': k => {
    for (const x of [-0.09, 0.09]) k.put(k.pelvis, G.cone(1, 1, 5), k.M.cloth2, [x, -0.2, -0.1], undefined, [0.14, 0.5, 0.1]);
    collarChip(k);
    for (const x of [-0.07, 0.07]) k.put(k.torso, G.box(0.02, 0.2, 0.012), k.M.acc, [x, 0.3, 0.125]);
    k.put(k.torso, G.box(0.16, 0.02, 0.012), k.M.acc, [0, 0.22, 0.125]);
  },
  synthesist: k => {
    collarChip(k);
    k.put(k.torso, G.torus(0.21, 0.014, 6, 18), k.M.acc, [0, 0.4, 0], [Math.PI / 2, 0, 0.3]);
    for (const x of [-0.09, 0.09]) k.put(k.torso, G.cyl(0.07, 0.07, 0.3, 8), k.M.dark, [x, 0.3, -0.16]);
  },
  surgeon: k => {
    k.put(k.torso, G.cyl(0.215, 0.26, 0.42, 10), k.M.white, [0, 0.2, 0], undefined, [1, 1, 0.92]);
    k.put(k.torso, G.box(0.07, 0.02, 0.02), k.M.red, [0.1, 0.36, 0.14]); k.put(k.torso, G.box(0.02, 0.07, 0.02), k.M.red, [0.1, 0.36, 0.14]);
    if (!k.dog && !k.synth) { k.put(k.head, G.cyl(0.17, 0.18, 0.06, 12), k.M.white, [0, 0.13, 0]); k.flags.hood = true; }
  },
  warden: k => {
    k.put(k.torso, G.box(0.24, 0.3, 0.12), k.M.dark, [0, 0.28, -0.17]);
    k.put(k.torso, G.cyl(0.012, 0.012, 0.7, 5), k.M.metal, [0.08, 0.8, -0.17]);
    k.put(k.torso, G.cone(1, 1, 10), k.M.metal, [-0.06, 0.62, -0.17], [Math.PI / 2, 0, 0], [0.12, 0.05, 0.12]);
    pads(k, 0.1); helmet(k);
  },
  'carbon-king': k => {
    k.put(k.head, G.cyl(0.15, 0.17, 0.09, 8), k.M.trim, [0, 0.19, 0]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.put(k.head, G.cone(0.03, 0.09, 4), k.M.trim, [Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15]); }
    k.put(k.torso, G.box(0.4, 0.75, 0.03), k.M.cloth2, [0, 0.12, -0.15], [0.08, 0, 0]); pads(k, 0.13);
  },
  'ghost-signal': k => {
    k.flags.hood = true; k.put(k.head, G.sph(0.2, 12, 10), k.M.cloth, [0, 0.03, -0.02], undefined, [1, 1, 1.05]);
    k.put(k.torso, G.torus(0.3, 0.01, 6, 24), k.M.acc, [0, 0.3, 0], [Math.PI / 2, 0, 0]); collarChip(k);
  },
  'echo-vessel': k => {
    k.put(k.torso, G.torus(0.34, 0.012, 6, 24), k.M.acc, [0, 0.3, 0], [Math.PI / 2.4, 0, 0]);
    k.put(k.torso, G.torus(0.3, 0.012, 6, 24), k.M.acc, [0, 0.3, 0], [Math.PI / 2, 0, Math.PI / 3]); collarChip(k);
  },
};

/* ------------------------------ builder ------------------------------ */

export function buildCharacter(spec: CharSpec): CharRig {
  const seed = hashStr(spec.uid);
  const enemy = spec.team === 'enemy', synth = spec.species === 'synth', dog = spec.species === 'canine';
  const base = new THREE.Color(spec.color);
  const clothC = enemy ? new THREE.Color(0x3d4658).lerp(base, 0.15) : base.clone().lerp(new THREE.Color(0x101a2c), 0.45);
  const furC = base.clone().lerp(new THREE.Color(0xf4dca4), 0.4);
  const trimHex = enemy ? 0xd1344a : 0xe3b94a, accHex = enemy ? 0xff4d5e : 0x2de2d0;
  const ghost: MatOpts = synth ? { transparent: true, opacity: 0.8, emissive: spec.color, ei: 0.45, rough: 0.3 } : {};
  const M: Mats = {
    cloth: mat(clothC.getHex(), { rough: 0.7, metal: 0.08, ...ghost }),
    cloth2: mat(clothC.clone().lerp(new THREE.Color(0xffffff), 0.2).getHex(), { rough: 0.7, ...ghost }),
    pants: mat(enemy ? 0x2a2e3a : 0x252d3d, { rough: 0.85, metal: 0.02, ...ghost }),
    boots: mat(0x1b1f29, { rough: 0.7, metal: 0.2 }),
    skin: synth ? mat(spec.color, { ...ghost, opacity: 0.9 }) : mat(dog ? furC.getHex() : SKINS[seed % SKINS.length], { rough: 0.7, metal: 0 }),
    trim: mat(trimHex, { rough: 0.35, metal: 0.65 }),
    metal: mat(enemy ? 0x7b8494 : 0xaab6c6, { rough: 0.32, metal: 0.85 }),
    dark: mat(0x1d2230, { rough: 0.55, metal: 0.35 }),
    acc: mat(accHex, { emissive: accHex, ei: 1.5, rough: 0.3 }),
    white: mat(0xf2f2f2, { rough: 0.35, metal: 0 }),
    black: mat(0x12141a, { rough: 0.25, metal: 0 }),
    red: mat(enemy ? 0xd1344a : 0xc7453b, { rough: 0.6, metal: 0 }),
  };

  const parts: RigPart[] = [];
  const put: Put = (parent, g, m, p = [0, 0, 0], r, s) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(p[0], p[1], p[2]);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    if (s) mesh.scale.set(s[0], s[1], s[2]);
    mesh.frustumCulled = false;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    parent.add(mesh); parts.push({ mesh, mat: m });
    return mesh;
  };
  const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();
  const body = grp(root);
  const pelvis = grp(body, 0, 0.67, 0);

  // legs
  const leg = (s: number) => {
    const hip = grp(pelvis, 0.1 * s, -0.04, 0);
    put(hip, G.cyl(0.075, 0.062, 0.3, 8), M.pants, [0, -0.15, 0]);
    const knee = grp(hip, 0, -0.3, 0);
    put(knee, G.sph(0.062, 8, 6), M.pants);
    put(knee, G.cyl(0.062, 0.05, 0.28, 8), M.pants, [0, -0.14, 0]);
    put(knee, G.box(0.12, 0.09, 0.24), M.boots, [0, -0.285, 0.04]);
    return { hip, knee };
  };
  const lL = leg(-1), lR = leg(1);

  // torso
  const torso = grp(pelvis, 0, 0.05, 0);
  put(torso, G.box(0.3, 0.14, 0.2), M.pants, [0, 0.07, 0]);
  put(torso, G.box(0.32, 0.04, 0.21), M.dark, [0, 0.0, 0]);
  put(torso, G.box(0.06, 0.04, 0.02), M.trim, [0, 0, 0.11]);
  put(torso, G.cyl(0.21, 0.16, 0.34, 10), M.cloth, [0, 0.27, 0], undefined, [1, 1, 0.78]);
  put(torso, G.box(0.3, 0.17, 0.06), M.trim, [0, 0.31, 0.135]);
  put(torso, G.box(0.5, 0.05, 0.13), M.trim, [0, 0.43, 0]);
  put(torso, G.cyl(0.05, 0.06, 0.08, 8), M.skin, [0, 0.49, 0]);

  // head
  const head = grp(torso, 0, 0.62, 0);
  put(head, G.sph(0.17, 14, 12), M.skin);
  if (dog) {
    const muzzle = mat(furC.clone().lerp(new THREE.Color(0xffffff), 0.5).getHex(), { rough: 0.8, metal: 0 });
    const ear = mat(furC.clone().lerp(new THREE.Color(0x6b3f10), 0.4).getHex(), { rough: 0.85, metal: 0 });
    put(head, G.box(0.13, 0.09, 0.17), muzzle, [0, -0.05, 0.17], [0.05, 0, 0]);
    put(head, G.sph(0.036, 10, 8), M.black, [0, -0.025, 0.26]);
    put(head, G.box(0.04, 0.012, 0.07), mat(0xff8aa0, { rough: 0.6, metal: 0 }), [0, -0.1, 0.22], [0.2, 0, 0]);
    put(head, G.cone(0.075, 0.24, 6), ear, [-0.11, 0.2, -0.01], [0, 0, 0.22]);
    put(head, G.cone(0.075, 0.22, 6), ear, [0.13, 0.12, -0.01], [0, 0, -1.25]);
    for (const x of [-0.07, 0.07]) {
      put(head, G.sph(0.04, 8, 8), M.white, [x, 0.04, 0.14]); put(head, G.sph(0.021, 6, 6), M.black, [x, 0.04, 0.175]);
      put(head, G.sph(0.016, 6, 6), ear, [x, 0.1, 0.15]);
    }
  } else if (synth) {
    put(head, G.box(0.26, 0.06, 0.05), mat(0x0b1020, { emissive: spec.color, ei: 1.3, rough: 0.3 }), [0, 0.02, 0.15]);
    put(head, G.cyl(0.008, 0.008, 0.14, 4), M.trim, [0.1, 0.25, 0]);
    put(head, G.sph(0.022, 6, 6), M.acc, [0.1, 0.33, 0]);
  } else {
    for (const x of [-0.065, 0.065]) {
      put(head, G.sph(0.032, 8, 8), M.white, [x, 0.02, 0.148]); put(head, G.sph(0.016, 6, 6), M.black, [x, 0.02, 0.176]);
      put(head, G.box(0.06, 0.012, 0.02), M.black, [x, 0.075, 0.158]);
    }
    put(head, G.box(0.035, 0.045, 0.04), M.skin, [0, -0.03, 0.165]);
  }

  // arms
  const arm = (s: number, glove: THREE.Material) => {
    const sh = grp(torso, 0.26 * s, 0.4, 0);
    put(sh, G.sph(0.085, 8, 6), M.trim);
    put(sh, G.cyl(0.058, 0.05, 0.25, 8), M.cloth, [0, -0.125, 0]);
    const el = grp(sh, 0, -0.25, 0);
    put(el, G.sph(0.05, 8, 6), M.cloth);
    put(el, G.cyl(0.05, 0.042, 0.23, 8), dog || synth ? M.skin : M.cloth2, [0, -0.115, 0]);
    const hand = grp(el, 0, -0.245, 0);
    put(hand, G.sph(0.056, 8, 6), glove);
    return { sh, el, hand };
  };
  const glove = dog || synth ? M.skin : M.dark;
  const aL = arm(-1, glove), aR = arm(1, glove);

  const hasWeapon = !!spec.wType;
  const twoHanded = !!spec.wType && !['Sword', 'Mace', 'Pistol'].includes(spec.wType);
  let muzzle: THREE.Object3D = aR.hand;
  if (spec.wType) {
    const mount = grp(aR.hand, 0, -0.02, 0);
    mount.rotation.x = 1.6;          // cancels the idle arm pose so the barrel points forward
    mount.updateMatrix();
    mount.matrixAutoUpdate = false;
    const w = buildWeapon(spec.wType);
    mount.add(w.group);
    muzzle = w.tip;
    w.group.traverse(o => { if ((o as THREE.Mesh).isMesh) parts.push({ mesh: o as THREE.Mesh, mat: (o as THREE.Mesh).material as THREE.Material }); });
  }
  // shield: only for one-handed melee (sword / mace)
  if (spec.hasShield && (spec.wType === 'Sword' || spec.wType === 'Mace')) {
    put(aL.el, G.cyl(0.21, 0.21, 0.04, 16), M.metal, [-0.06, -0.1, 0.1], [Math.PI / 2, 0, 0]);
    put(aL.el, G.sph(0.06, 8, 6), M.trim, [-0.06, -0.1, 0.13]);
    put(aL.el, G.torus(0.19, 0.016, 6, 20), M.trim, [-0.06, -0.1, 0.12]);
  }

  // job armor kit (may set flags.helmet / flags.hood to suppress hair)
  const kit: Kit = { put, M, torso, head, pelvis, enemy, dog, synth, flags: { helmet: false, hood: false } };
  (KITS[spec.jobId] ?? KITS.drifter)(kit);

  // hair + hats (humans only)
  if (!dog && !synth && !kit.flags.helmet && !kit.flags.hood) {
    const hm = mat(HAIRS[(seed >> 3) % HAIRS.length], { rough: 0.85, metal: 0 });
    put(head, G.sph(0.18, 14, 10), hm, [0, 0.06, -0.03], undefined, [1, 0.62, 1]);
    const style = (seed >> 6) % 3;
    if (style === 1) put(head, G.box(0.3, 0.26, 0.1), hm, [0, -0.05, -0.15]);
    if (style === 2) put(head, G.cyl(0.04, 0.03, 0.26, 6), hm, [0, -0.02, -0.2], [0.4, 0, 0]);
  }
  if (spec.hat === 'cowboy') {
    const hatM = mat(0x6e4a26, { rough: 0.9, metal: 0 });
    put(head, G.cyl(0.29, 0.31, 0.025, 14), hatM, [0, 0.14, 0]);
    put(head, G.cyl(0.12, 0.15, 0.15, 12), hatM, [0, 0.22, 0]);
    put(head, G.torus(0.135, 0.014, 6, 14), M.trim, [0, 0.16, 0], [Math.PI / 2, 0, 0]);
  }

  // tail (canine)
  let tail: THREE.Group | null = null;
  if (dog) {
    tail = grp(pelvis, 0, 0.0, -0.13);
    const fur = mat(furC.getHex(), { rough: 0.85, metal: 0 });
    put(tail, G.cone(0.05, 0.36, 7), fur, [0, 0.14, -0.1], [0.95, 0, 0]);
    put(tail, G.sph(0.048, 8, 8), mat(furC.clone().lerp(new THREE.Color(0xffffff), 0.5).getHex(), { rough: 0.85, metal: 0 }), [0, 0.29, -0.2]);
  }

  // non-part decorations: halo, team ring, blob shadow, buff shells
  const halo = new THREE.Mesh(G.torus(0.22, 0.02, 8, 28), M.acc);
  halo.position.set(0, 0.42, 0); halo.rotation.x = Math.PI / 2 + 0.25; halo.frustumCulled = false; head.add(halo);
  const ring = new THREE.Mesh(G.ring(0.44, 0.52, 36), ringMats[spec.team]);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.frustumCulled = false; root.add(ring);
  blobMat ??= share(new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.8, depthWrite: false }));
  const shadow = new THREE.Mesh(G.circle(0.5, 24), blobMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.022; shadow.renderOrder = 2; shadow.frustumCulled = false; root.add(shadow);
  const bubble = new THREE.Mesh(G.sph(0.68, 14, 12), mat(0x60a5fa, { transparent: true, opacity: 0.2, emissive: 0x3b82f6, ei: 0.5, depthWrite: false }));
  bubble.position.y = 0.75; bubble.visible = false; bubble.frustumCulled = false; root.add(bubble);
  const shell = new THREE.Mesh(G.ico(0.66, 0), mat(0xfacc15, { transparent: true, opacity: 0.26, emissive: 0xf59e0b, ei: 0.4, depthWrite: false }));
  shell.position.y = 0.75; shell.visible = false; shell.frustumCulled = false; root.add(shell);

  return {
    root, body, pelvis, torso, head, shL: aL.sh, shR: aR.sh, elL: aL.el, elR: aR.el, handR: aR.hand,
    hipL: lL.hip, hipR: lR.hip, kneeL: lL.knee, kneeR: lL.knee, tail, halo, ring, shadow, bubble, shell, muzzle,
    twoHanded: twoHanded && hasWeapon, parts, fadeMats: [], walkBlend: 0, flashing: false, castE: 0,
    anim: {
      moving: false, walkPhase: 0, phase: (seed % 100) / 100 * 6.28, hopT0: 0, hopDur: 0,
      swingKind: '', swingT0: 0, swingDur: 0, burst: 1,
      hitT0: 0, hitDx: 0, hitDz: 0, blockUntil: 0, freezeUntil: 0,
      guard: false, aim: false, victory: false,
      deadT0: 0, dead: false, flashUntil: 0, excited: 0,
    },
    spec,
  };
}

/* ------------------------------ animation ------------------------------ */

const smooth = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => clamp(v, 0, 1);
function kf(p: number, k: number[][]): number {
  for (let i = 0; i < k.length - 1; i++) {
    const [p0, v0] = k[i], [p1, v1] = k[i + 1];
    if (p <= p1) return v0 + (v1 - v0) * smooth(clamp01((p - p0) / (p1 - p0)));
  }
  return k[k.length - 1][1];
}

// Expressive keyframe tables: windup anticipation -> explosive strike + lunge + wrist snap -> follow-through recovery
const MELEE = {
  sh: [[0, -1.05], [0.24, -2.85], [0.46, -0.15], [0.7, -0.45], [1, -1.05]],
  el: [[0, -0.55], [0.24, -0.85], [0.46, -0.06], [0.7, -0.25], [1, -0.55]],
  wr: [[0, 0], [0.24, -0.45], [0.48, 0.72], [0.75, 0.25], [1, 0]],
  ty: [[0, 0], [0.24, -0.78], [0.48, 0.82], [0.74, 0.3], [1, 0]],
  tx: [[0, 0], [0.24, -0.16], [0.48, 0.36], [1, 0]],
  lunge: [[0, 0], [0.24, -0.16], [0.46, 0.62], [0.75, 0.16], [1, 0]],
  crouch: [[0, 0], [0.24, -0.05], [0.46, -0.09], [1, 0]],
};
const SLAM = {
  sh: [[0, -1.05], [0.32, -3.15], [0.54, 0.05], [0.76, -0.2], [1, -1.05]],
  el: [[0, -0.55], [0.32, -0.25], [0.54, -0.04], [1, -0.55]],
  wr: [[0, 0], [0.32, -0.5], [0.55, 0.85], [1, 0]],
  ty: [[0, 0], [0.32, -0.22], [0.54, 0.24], [1, 0]],
  tx: [[0, 0], [0.32, -0.36], [0.54, 0.56], [0.78, 0.2], [1, 0]],
  lunge: [[0, 0], [0.32, -0.15], [0.54, 0.52], [0.8, 0.14], [1, 0]],
  crouch: [[0, 0], [0.32, 0.06], [0.55, -0.15], [0.78, -0.06], [1, 0]],
};
const THRUST = {
  sh: [[0, -1.05], [0.26, -0.65], [0.46, -1.58], [0.72, -1.3], [1, -1.05]],
  el: [[0, -0.55], [0.26, -1.2], [0.46, -0.02], [1, -0.55]],
  wr: [[0, 0], [0.26, -0.2], [0.46, 0.32], [1, 0]],
  ty: [[0, 0], [0.26, -0.55], [0.46, 0.48], [1, 0]],
  tx: [[0, 0], [0.26, -0.08], [0.46, 0.24], [1, 0]],
  lunge: [[0, 0], [0.26, -0.24], [0.46, 0.74], [0.76, 0.18], [1, 0]],
  crouch: [[0, 0], [0.26, -0.06], [0.46, -0.1], [1, 0]],
};
const LEAP = {
  sh: [[0, -1.05], [0.35, -3.1], [0.64, -0.05], [0.82, -0.35], [1, -1.05]],
  el: [[0, -0.55], [0.35, -0.3], [0.64, -0.05], [1, -0.55]],
  wr: [[0, 0], [0.35, -0.4], [0.65, 0.85], [1, 0]],
  ty: [[0, 0], [0.35, -0.3], [0.64, 0.45], [1, 0]],
  tx: [[0, 0], [0.25, -0.25], [0.64, 0.55], [0.82, 0.22], [1, 0]],
  lunge: [[0, 0], [0.15, -0.12], [0.62, 0.88], [0.85, 0.2], [1, 0]],
  arcY: [[0, 0], [0.14, -0.1], [0.42, 0.88], [0.64, 0.0], [0.76, -0.14], [1, 0]],
};

export function updateRig(r: CharRig, t: number, dt: number, now: number) {
  const a = r.anim;

  // flash swap still updates during hit-stop so white impact flash appears immediately
  const fl = now < a.flashUntil;
  if (fl !== r.flashing) {
    r.flashing = fl;
    for (const p of r.parts) p.mesh.material = fl ? flashMat : p.mat;
  }
  if (now < a.freezeUntil && !a.deadT0) return;

  const ph = a.phase;
  r.walkBlend += ((a.moving ? 1 : 0) - r.walkBlend) * Math.min(1, dt * 14);
  if (a.moving) a.walkPhase += dt * 13;
  const wp = a.walkPhase, wb = r.walkBlend, s = Math.sin(wp), c = Math.cos(wp);

  let hipLx = -s * 0.8 * wb, hipRx = s * 0.8 * wb;
  let kneeLx = (1 - c) * 0.42 * wb, kneeRx = (1 + c) * 0.42 * wb;

  let shRx = -1.05, shRz = 0.18, elRx = -0.55, handRx = 0;
  let shLx = r.twoHanded ? -1.05 : 0.08, shLz = r.twoHanded ? -0.32 : 0.14, elLx = r.twoHanded ? -0.8 : -0.25;
  shLx -= s * 0.7 * wb * (r.twoHanded ? 0.15 : 1); shRx += s * 0.1 * wb;

  const br = Math.sin(t * 2 + ph);
  let bodyX = 0, bodyZ = 0, bodyY = br * 0.008 + Math.abs(s) * 0.055 * wb;
  let torsoRx = wb * 0.08, torsoRy = s * 0.12 * wb, headRx = 0, shLy = 0;
  let sqY = 1, castE = 0;

  // tactical idle stances (when not walking or mid-swing)
  if (!a.moving && !a.swingKind && !a.deadT0) {
    if (a.victory) {
      const pump = Math.abs(Math.sin(t * 5.2 + ph));
      bodyY += pump * 0.08;
      shRx = -2.55 - pump * 0.35; elRx = -0.2; shRz = 0.25;
      shLx = -0.6 - pump * 0.25; elLx = -0.5;
      headRx = -0.14;
    } else if (a.guard) {
      bodyY -= 0.06; torsoRx = 0.14; torsoRy = -0.28;
      shLx = -1.15; shLy = 0.65; elLx = -0.85;
      kneeLx += 0.22; kneeRx += 0.22; hipLx -= 0.14; hipRx -= 0.14;
    } else if (a.aim) {
      bodyY -= 0.03; torsoRx = 0.08; torsoRy = -0.22; headRx = 0.09;
      shRx = -1.48; elRx = -0.22;
      if (r.twoHanded) { shLx = -1.42; elLx = -0.65; }
    }
  }

  // hop squash & stretch
  if (a.hopDur > 0 && now < a.hopT0 + a.hopDur * 1.35) {
    const p = (now - a.hopT0) / a.hopDur;
    sqY = p < 0.15 ? 1 - 0.2 * (p / 0.15) : p < 0.85 ? 1 + 0.16 * Math.sin(((p - 0.15) / 0.7) * Math.PI) : p < 1 ? 1 - 0.2 * ((p - 0.85) / 0.15) : 0.8 + 0.2 * smooth(clamp01((p - 1) / 0.35));
  }

  // attacks / casts
  if (a.swingKind && now < a.swingT0 + a.swingDur) {
    const p = (now - a.swingT0) / a.swingDur;
    if (a.swingKind === 'melee' || a.swingKind === 'slam' || a.swingKind === 'thrust') {
      const T = a.swingKind === 'melee' ? MELEE : a.swingKind === 'slam' ? SLAM : THRUST;
      shRx = kf(p, T.sh); elRx = kf(p, T.el); handRx = kf(p, T.wr);
      torsoRy = kf(p, T.ty); torsoRx = kf(p, T.tx);
      const lg = kf(p, T.lunge);
      bodyZ = lg; bodyY += kf(p, T.crouch);
      // athletic front-leg lunge step & off-arm counterbalance
      const step = Math.max(0, lg);
      hipRx -= step * 0.85; kneeRx += step * 0.9;
      hipLx += step * 0.65; kneeLx += step * 0.2;
      shLx = lerp(shLx, -0.55 - torsoRy * 0.4, 0.7);
      shLz = lerp(shLz, 0.42, 0.5);
    } else if (a.swingKind === 'leap') {
      shRx = kf(p, LEAP.sh); elRx = kf(p, LEAP.el); handRx = kf(p, LEAP.wr);
      torsoRy = kf(p, LEAP.ty); torsoRx = kf(p, LEAP.tx);
      bodyZ = kf(p, LEAP.lunge);
      const ay = kf(p, LEAP.arcY);
      bodyY += ay;
      const tuck = Math.max(0, ay);
      hipLx -= tuck * 0.9; kneeLx += tuck * 1.3;
      hipRx -= tuck * 0.6; kneeRx += tuck * 1.0;
      shLx = -1.4 * Math.min(1, p * 2.5);
    } else if (a.swingKind === 'gun') {
      const aimIn = Math.min(1, p * 6) * Math.min(1, (1 - p) * 4);
      shRx = lerp(shRx, -1.48, aimIn);
      elRx = lerp(elRx, -0.22, aimIn);
      if (r.twoHanded) { shLx = lerp(shLx, -1.38, aimIn); elLx = lerp(elLx, -0.62, aimIn); }
      const kick = Math.pow(Math.abs(Math.sin(p * Math.PI * a.burst)), 1.6) * (1 - p * 0.5);
      shRx -= kick * 0.34; handRx -= kick * 0.22; bodyZ -= kick * 0.09; torsoRx -= kick * 0.13; headRx = 0.07 * aimIn - kick * 0.06;
    } else {
      castE = Math.min(1, p * 3.5) * Math.min(1, (1 - p) * 3.5);
      shRx = lerp(shRx, -2.8, castE); shLx = lerp(shLx, -2.8, castE);
      shRz += 0.3 * castE; shLz -= 0.3 * castE; elRx = lerp(elRx, -0.2, castE); elLx = lerp(elLx, -0.2, castE);
      torsoRx = -0.15 * castE; headRx = -0.2 * castE; bodyY += castE * 0.07;
    }
  } else if (a.swingKind) a.swingKind = '';
  r.castE = castE;

  // shield block deflection vs unshielded hit recoil
  if (now < a.blockUntil) {
    const k = (a.blockUntil - now) / 280;
    shLx = -1.28; shLy = 0.85 * k; elLx = -0.95;
    torsoRy = -0.35 * k; torsoRx = 0.12 * k; bodyZ -= 0.09 * k;
  } else if (a.hitT0 && now < a.hitT0 + 340) {
    const k = 1 - (now - a.hitT0) / 340, y = r.root.rotation.y;
    bodyX += (a.hitDx * Math.cos(y) - a.hitDz * Math.sin(y)) * 0.28 * k;
    bodyZ += (a.hitDx * Math.sin(y) + a.hitDz * Math.cos(y)) * 0.28 * k;
    torsoRx -= 0.46 * k; headRx -= 0.3 * k; shLx -= 0.65 * k; shLy = 0.42 * k;
    kneeLx += 0.22 * k; kneeRx += 0.22 * k;
  }

  // death: fall back, then fade
  let bodyRx = 0, fade = 1;
  if (a.deadT0) {
    const pd = (now - a.deadT0) / 1200, fall = smooth(clamp01(pd / 0.5));
    bodyRx = -1.5 * fall; bodyY += 0.12 * fall; shRx = lerp(shRx, -0.4, fall); shLx = lerp(shLx, -0.2, fall);
    shRz = lerp(shRz, 0.9, fall); shLz = lerp(shLz, -0.9, fall);
    fade = pd < 0.5 ? 1 : 1 - clamp01((pd - 0.5) / 0.5);
    for (const m of r.fadeMats) m.opacity = fade;
    r.shadow.scale.setScalar(Math.max(0.01, fade));
    if (pd >= 1) a.dead = true;
  }

  r.hipL.rotation.x = hipLx; r.hipR.rotation.x = hipRx;
  r.kneeL.rotation.x = kneeLx; r.kneeR.rotation.x = kneeRx;
  r.body.position.set(bodyX, bodyY, bodyZ);
  r.body.rotation.x = bodyRx;
  r.body.scale.set(1 / Math.sqrt(sqY), sqY, 1 / Math.sqrt(sqY));
  r.torso.rotation.set(torsoRx, torsoRy, 0);
  r.torso.scale.set(1 - br * 0.006, 1 + br * 0.012, 1);
  r.head.rotation.set(headRx, Math.sin(t * 0.7 + ph) * 0.12 * (1 - wb), 0);
  r.shR.rotation.set(shRx, 0, shRz); r.elR.rotation.set(elRx, 0, 0); r.handR.rotation.x = handRx;
  r.shL.rotation.set(shLx, shLy, shLz); r.elL.rotation.set(elLx, 0, 0);
  const wagBoost = a.excited + (a.victory ? 1.4 : 0);
  if (r.tail) r.tail.rotation.y = Math.sin(t * (7 + wagBoost * 5) + ph) * (0.45 + wagBoost * 0.1);
  r.halo.rotation.z += dt * (1.2 + castE * 10);
  const hs = 1 + Math.sin(t * 3 + ph) * 0.06 + castE * 0.25;
  r.halo.scale.set(hs, hs, 1);
}

export function rigSwing(r: CharRig, kind: SwingKind, now: number, burst = 1) {
  r.anim.swingKind = kind; r.anim.swingT0 = now; r.anim.burst = burst;
  r.anim.swingDur =
    kind === 'melee' ? 540 :
    kind === 'slam' ? 580 :
    kind === 'thrust' ? 480 :
    kind === 'leap' ? 680 :
    kind === 'gun' ? 300 + burst * 125 : 900;
}
export function rigHit(r: CharRig, dx: number, dz: number, now: number, blocked = false, heavy = false) {
  const d = Math.hypot(dx, dz) || 1;
  r.anim.hitT0 = now; r.anim.hitDx = dx / d; r.anim.hitDz = dz / d;
  r.anim.flashUntil = now + (heavy ? 175 : 130);
  if (blocked) r.anim.blockUntil = now + 280;
  if (heavy) r.anim.freezeUntil = now + 55;
}
export function rigFreeze(r: CharRig, ms: number, now: number) {
  r.anim.freezeUntil = Math.max(r.anim.freezeUntil, now + ms);
}
export function rigDie(r: CharRig, now: number) {
  if (r.anim.deadT0) return;
  r.anim.deadT0 = now;
  for (const p of r.parts) {
    const m = p.mat.clone(); m.transparent = true; m.depthWrite = false;
    p.mat = m; r.fadeMats.push(m);
    if (!r.flashing) p.mesh.material = m;
  }
  r.ring.visible = false; r.bubble.visible = false; r.shell.visible = false;
}
export function disposeRig(r: CharRig) { r.fadeMats.forEach(m => m.dispose()); r.fadeMats = []; }
