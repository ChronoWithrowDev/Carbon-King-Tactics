import * as THREE from 'three';
import type { WeaponType } from '../game/jobs';
import { G, mat } from './kit';

/** Weapon models. Grip sits at the origin, barrel/blade points along +Z. `tip` marks the muzzle / blade tip. */

interface WeaponModel { group: THREE.Group; tip: THREE.Object3D }

const steel = () => mat(0xc4ced9, { metal: 0.85, rough: 0.28 });
const dark = () => mat(0x2f3540, { metal: 0.6, rough: 0.45 });
const wood = () => mat(0x6b4a2b, { metal: 0, rough: 0.85 });
const gold = () => mat(0xc9a227, { metal: 0.8, rough: 0.35 });
const glow = () => mat(0x22d3ee, { emissive: 0x22d3ee, ei: 1.4, rough: 0.3 });

export function buildWeapon(w: WeaponType): WeaponModel {
  const group = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p); mesh.rotation.set(...r);
    mesh.frustumCulled = false;
    mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
    group.add(mesh);
  };
  let tipZ = 0.5;
  switch (w) {
    case 'Sword':
      add(G.box(0.085, 0.028, 0.62), steel(), [0, 0, 0.4]); add(G.box(0.028, 0.085, 0.62), steel(), [0, 0, 0.4]);
      add(G.box(0.22, 0.05, 0.05), gold(), [0, 0, 0.07]); add(G.cyl(0.03, 0.03, 0.16, 8), dark(), [0, 0, -0.04], [Math.PI / 2, 0, 0]);
      add(G.sph(0.035, 8, 6), gold(), [0, 0, -0.13]); tipZ = 0.72; break;
    case 'Spear':
      add(G.cyl(0.028, 0.028, 1.4, 8), wood(), [0, 0, 0.4], [Math.PI / 2, 0, 0]); add(G.cone(0.06, 0.26, 8), steel(), [0, 0, 1.2], [Math.PI / 2, 0, 0]);
      add(G.torus(0.045, 0.012, 6, 10), gold(), [0, 0, 1.04]); tipZ = 1.34; break;
    case 'Mace':
      add(G.cyl(0.032, 0.035, 0.52, 8), wood(), [0, 0, 0.2], [Math.PI / 2, 0, 0]); add(G.dodeca(0.13), dark(), [0, 0, 0.5]);
      add(G.sph(0.045, 8, 6), steel(), [0, 0.11, 0.5]); tipZ = 0.55; break;
    case 'Pistol':
      add(G.box(0.08, 0.11, 0.3), dark(), [0, 0.02, 0.16]); add(G.box(0.07, 0.15, 0.08), wood(), [0, -0.08, 0.05]);
      add(G.cyl(0.02, 0.02, 0.1, 6), steel(), [0, 0.03, 0.34], [Math.PI / 2, 0, 0]); tipZ = 0.4; break;
    case 'SMG':
      add(G.box(0.09, 0.11, 0.44), dark(), [0, 0, 0.22]); add(G.box(0.06, 0.17, 0.07), steel(), [0, -0.12, 0.25]);
      add(G.box(0.05, 0.05, 0.12), dark(), [0, 0.07, 0.1]); tipZ = 0.5; break;
    case 'Assault':
      add(G.box(0.09, 0.12, 0.58), dark(), [0, 0, 0.28]); add(G.box(0.06, 0.15, 0.08), steel(), [0, -0.11, 0.3]);
      add(G.box(0.08, 0.14, 0.15), wood(), [0, -0.02, -0.07]); add(G.box(0.04, 0.05, 0.2), dark(), [0, 0.085, 0.22]); tipZ = 0.66; break;
    case 'LongRifle':
      add(G.cyl(0.022, 0.022, 0.9, 8), steel(), [0, 0.02, 0.5], [Math.PI / 2, 0, 0]); add(G.box(0.08, 0.11, 0.34), wood(), [0, -0.02, 0.05]);
      add(G.cyl(0.038, 0.038, 0.15, 8), dark(), [0, 0.09, 0.08], [Math.PI / 2, 0, 0]); add(G.cyl(0.012, 0.012, 0.25, 6), dark(), [0, -0.07, 0.6], [Math.PI / 2, 0, 0]);
      tipZ = 0.96; break;
    case 'DEW':
      add(G.box(0.11, 0.13, 0.4), dark(), [0, 0, 0.2]);
      for (let i = 0; i < 3; i++) add(G.torus(0.085, 0.018, 6, 14), glow(), [0, 0, 0.08 + i * 0.13]);
      add(G.sph(0.05, 10, 8), glow(), [0, 0, 0.45]); add(G.box(0.05, 0.14, 0.07), steel(), [0, -0.1, 0.03]); tipZ = 0.5; break;
  }
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, tipZ);
  group.add(tip);
  return { group, tip };
}
