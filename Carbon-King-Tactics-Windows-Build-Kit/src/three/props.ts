import * as THREE from 'three';
import { G, mergeParts, share, type Part } from './kit';

/** Set dressing: every prop type is merged into ONE vertex-colored geometry and drawn with an InstancedMesh. */

const P = (g: THREE.BufferGeometry, c: number, p: Part['p'], extra: Partial<Part> = {}): Part => ({ g, c, p, ...extra });
const GL = (g: THREE.BufferGeometry, c: number, p: Part['p'], extra: Partial<Part> = {}): Part => ({ g, c, p, glow: true, ...extra });
const cone = (c: number, r: number, h: number, y: number, seg = 7, extra: Partial<Part> = {}) => P(G.cone(1, 1, seg), c, [0, y, 0], { s: [r, h, r], ...extra });

function windows(hw: number, hd: number, rows: number, y0: number, dy: number, cols: number, c = 0xffd37a): Part[] {
  const out: Part[] = [];
  for (let f = 0; f < 4; f++) {
    const w = f < 2 ? hw * 2 : hd * 2;
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      if ((r * 7 + i * 5 + f * 3) % 5 === 0) continue;
      const off = (i - (cols - 1) / 2) * (w / (cols + 0.5)), y = y0 + r * dy;
      const pos: Part['p'] = f === 0 ? [off, y, hd + 0.012] : f === 1 ? [-off, y, -hd - 0.012] : f === 2 ? [hw + 0.012, y, -off] : [-hw - 0.012, y, off];
      const ry = f === 0 ? 0 : f === 1 ? Math.PI : f === 2 ? Math.PI / 2 : -Math.PI / 2;
      out.push(GL(G.box(0.12, 0.1, 0.02), (r + i + f) % 3 === 0 ? 0x9be9ff : c, pos, { r: [0, ry, 0] }));
    }
  }
  return out;
}

const rackLeds = (w: number, h: number, z: number, rows: number): Part[] =>
  Array.from({ length: rows }, (_, i) => GL(G.box(w, 0.022, 0.012), i % 2 ? 0xfacc15 : 0x2de2d0, [0, 0.12 + i * ((h - 0.2) / rows), z]));

const DEFS: Record<string, () => Part[]> = {
  pine: () => [P(G.cyl(0.05, 0.07, 0.35, 6), 0x5a3a1a, [0, 0.175, 0]), cone(0x2f6b3a, 0.34, 0.6, 0.6), cone(0x388450, 0.25, 0.5, 0.87), cone(0x42995a, 0.16, 0.4, 1.15)],
  snowpine: () => [P(G.cyl(0.05, 0.07, 0.35, 6), 0x5a3a1a, [0, 0.175, 0]), cone(0x2d5a45, 0.34, 0.6, 0.6), cone(0xdfe9f3, 0.25, 0.5, 0.87), cone(0xf2f7fb, 0.16, 0.4, 1.15)],
  rock: () => [P(G.dodeca(1), 0x7b7f86, [0, 0.14, 0], { s: [0.26, 0.2, 0.3], r: [0.3, 0.6, 0] }), P(G.dodeca(1), 0x8d9199, [0.24, 0.07, 0.12], { s: [0.13, 0.1, 0.14] })],
  redrock: () => [P(G.box(0.3, 0.75, 0.3), 0xa85f3c, [0, 0.37, 0]), P(G.box(0.42, 0.3, 0.34), 0x8a4a32, [0.25, 0.15, 0.1]), P(G.box(0.22, 0.45, 0.22), 0xb86a46, [-0.22, 0.22, -0.1]), P(G.box(0.34, 0.06, 0.34), 0xd08a5a, [0, 0.77, 0])],
  cactus: () => [P(G.cyl(0.07, 0.08, 0.6, 7), 0x3f7d3a, [0, 0.3, 0]), P(G.cyl(0.05, 0.05, 0.28, 6), 0x3f7d3a, [0.14, 0.34, 0], { r: [0, 0, 0.6] }), P(G.cyl(0.045, 0.045, 0.22, 6), 0x3f7d3a, [-0.12, 0.28, 0], { r: [0, 0, -0.7] })],
  crate: () => [P(G.box(0.34, 0.3, 0.34), 0x8a6a3a, [0, 0.15, 0]), P(G.box(0.36, 0.04, 0.36), 0x5a4528, [0, 0.3, 0]), P(G.box(0.2, 0.2, 0.2), 0x9a7a44, [0.1, 0.4, 0.04], { r: [0, 0.5, 0] })],
  barrel: () => [P(G.cyl(0.13, 0.13, 0.34, 10), 0x5a6c82, [0, 0.17, 0]), P(G.cyl(0.135, 0.135, 0.03, 10), 0x2e3846, [0, 0.1, 0]), P(G.cyl(0.135, 0.135, 0.03, 10), 0x2e3846, [0, 0.25, 0])],
  fence: () => [...[-0.4, 0, 0.4].map(x => P(G.box(0.05, 0.4, 0.05), 0x6b4a2b, [x, 0.2, 0])), P(G.box(0.95, 0.04, 0.03), 0x7b5a3b, [0, 0.16, 0]), P(G.box(0.95, 0.04, 0.03), 0x7b5a3b, [0, 0.32, 0])],
  rack: () => [P(G.box(0.32, 0.8, 0.28), 0x1e242d, [0, 0.4, 0]), P(G.box(0.34, 0.04, 0.3), 0x3a4452, [0, 0.82, 0]), ...rackLeds(0.2, 0.8, 0.146, 6)],
  antenna: () => [P(G.cyl(0.025, 0.04, 1.3, 6), 0xc9d1db, [0, 0.65, 0]), P(G.cone(1, 1, 10), 0xe5eaf0, [0.1, 0.95, 0], { s: [0.2, 0.1, 0.2], r: [0, 0, -1.2] }), P(G.box(0.3, 0.02, 0.02), 0xc9d1db, [0, 1.15, 0]), GL(G.sph(0.045, 8, 6), 0xff4d4d, [0, 1.33, 0])],
  tent: () => [P(G.cone(1, 1, 4), 0xb9a06a, [0, 0.25, 0], { s: [0.34, 0.5, 0.34], r: [0, Math.PI / 4, 0] }), P(G.box(0.1, 0.22, 0.02), 0x3a2e1e, [0, 0.11, 0.17])],
  turbine: () => [P(G.cyl(0.04, 0.06, 1.5, 6), 0xe5eaf0, [0, 0.75, 0]), P(G.box(0.1, 0.1, 0.18), 0xcfd6de, [0, 1.5, 0.02])],
  ruin: () => [P(G.box(0.5, 0.55, 0.12), 0xc2a06e, [0, 0.27, 0]), P(G.box(0.12, 0.35, 0.4), 0xb8955e, [0.2, 0.17, 0.2]), P(G.box(0.3, 0.2, 0.1), 0xd1b07c, [-0.12, 0.65, 0])],
  lamp: () => [P(G.cyl(0.025, 0.035, 0.85, 6), 0x3a4452, [0, 0.42, 0]), P(G.box(0.16, 0.03, 0.05), 0x3a4452, [0.06, 0.86, 0]), GL(G.sph(0.06, 8, 6), 0xffd980, [0.12, 0.82, 0])],
  // obstacles
  building: () => [P(G.box(0.86, 0.9, 0.86), 0x8f9aa6, [0, 0.45, 0]), P(G.box(0.92, 0.06, 0.92), 0x3a4350, [0, 0.93, 0]), P(G.box(0.2, 0.1, 0.2), 0x5a6470, [0.2, 1.01, 0.1]), ...windows(0.43, 0.43, 2, 0.3, 0.32, 3)],
  building2: () => [P(G.box(0.8, 1.3, 0.8), 0x7d8a9a, [0, 0.65, 0]), P(G.box(0.86, 0.06, 0.86), 0x333c48, [0, 1.33, 0]), P(G.box(0.3, 0.14, 0.3), 0x56606c, [-0.15, 1.43, -0.1]), ...windows(0.4, 0.4, 3, 0.35, 0.32, 3)],
  tower: () => [P(G.box(0.8, 1.45, 0.8), 0x667385, [0, 0.72, 0]), P(G.box(0.56, 0.35, 0.56), 0x56626f, [0, 1.62, 0]), P(G.cyl(0.015, 0.025, 0.4, 5), 0xb9c2cc, [0, 1.98, 0]), GL(G.sph(0.04, 6, 5), 0xff4d4d, [0, 2.2, 0]), ...windows(0.4, 0.4, 5, 0.22, 0.26, 3, 0xffe29a)],
  tower2: () => [P(G.box(0.74, 1.2, 0.74), 0x5d6e84, [0, 0.6, 0]), P(G.box(0.8, 0.05, 0.8), 0x2e3744, [0, 1.22, 0]), ...windows(0.37, 0.37, 4, 0.25, 0.28, 3, 0x9be9ff)],
  wall: () => [P(G.box(1.0, 0.62, 1.0), 0x6d7889, [0, 0.31, 0]), ...[[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].map(([x, z]) => P(G.box(0.22, 0.16, 0.22), 0x7e8a9c, [x, 0.7, z])), GL(G.box(0.05, 0.22, 0.012), 0x2de2d0, [0, 0.36, 0.506]), GL(G.box(0.05, 0.22, 0.012), 0x2de2d0, [0.3, 0.36, 0.506])],
  rackbank: () => [P(G.box(0.9, 0.9, 0.5), 0x1e242d, [0, 0.45, 0]), P(G.box(0.94, 0.05, 0.54), 0x3a4452, [0, 0.92, 0]), ...rackLeds(0.7, 0.9, 0.256, 7), P(G.cyl(0.015, 0.02, 0.5, 5), 0xc9d1db, [0.3, 1.2, 0]), GL(G.sph(0.04, 6, 5), 0xff4d4d, [0.3, 1.47, 0])],
  chalet: () => [P(G.box(0.74, 0.42, 0.7), 0x8a6446, [0, 0.21, 0]), P(G.cone(1, 1, 4), 0x6b3a2a, [0, 0.62, 0], { s: [0.64, 0.42, 0.6], r: [0, Math.PI / 4, 0] }), P(G.cone(1, 1, 4), 0xeef4fa, [0, 0.72, 0], { s: [0.5, 0.22, 0.47], r: [0, Math.PI / 4, 0] }), P(G.box(0.1, 0.3, 0.1), 0x6e6a66, [0.22, 0.75, -0.1]), GL(G.box(0.14, 0.14, 0.02), 0xffc15a, [-0.18, 0.24, 0.355]), GL(G.box(0.14, 0.14, 0.02), 0xffc15a, [0.18, 0.24, 0.355])],
  mill: () => [P(G.box(0.9, 0.6, 0.8), 0x7d5b4b, [0, 0.3, 0]), P(G.box(0.96, 0.06, 0.86), 0x4a4048, [0, 0.63, 0]), P(G.cyl(0.12, 0.16, 1.1, 8), 0x9a6a58, [0.28, 1.1, -0.1]), P(G.cyl(0.13, 0.13, 0.05, 8), 0x2a2a2a, [0.28, 1.66, -0.1]), ...[-0.25, 0, 0.25].map(x => GL(G.box(0.12, 0.1, 0.02), 0xffb35a, [x, 0.36, 0.406]))],
  stack: () => [P(G.cyl(0.16, 0.22, 1.5, 10), 0x9a6a58, [0, 0.75, 0]), P(G.cyl(0.165, 0.165, 0.08, 10), 0xe5e5e5, [0, 1.05, 0]), P(G.cyl(0.17, 0.17, 0.06, 10), 0x2a2a2a, [0, 1.52, 0]), P(G.box(0.5, 0.3, 0.4), 0x6e5a4e, [0.3, 0.15, 0.2])],
};
const FOOT: Record<string, number> = { pine: 0.34, snowpine: 0.34, rock: 0.34, redrock: 0.42, cactus: 0.2, crate: 0.3, barrel: 0.2, fence: 0.5, rack: 0.28, antenna: 0.22, tent: 0.4, turbine: 0.22, ruin: 0.4, lamp: 0.15, building: 0.62, building2: 0.6, tower: 0.62, tower2: 0.58, wall: 0.68, rackbank: 0.6, chalet: 0.55, mill: 0.65, stack: 0.4 };

export interface Placement { kind: string; x: number; y: number; z: number; rot: number; s: number }
interface Spinner { mesh: THREE.InstancedMesh; items: Placement[] }
interface PropBatches { meshes: THREE.Object3D[]; spinners: Spinner[]; footprint(kind: string): number; update(t: number): void }

const bodyMat = share(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true }));
const glowMat = share(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
const geoCache = new Map<string, { body: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null }>();
let bladeGeo: THREE.BufferGeometry | null = null;

function geoFor(kind: string) {
  let e = geoCache.get(kind);
  if (!e) {
    const parts = (DEFS[kind] ?? DEFS.rock)();
    const body = mergeParts(parts, false), glow = mergeParts(parts, true);
    e = { body: body ? share(body) : null, glow: glow ? share(glow) : null };
    geoCache.set(kind, e);
  }
  return e;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), _q2 = new THREE.Quaternion();

export function buildPropBatches(scene: THREE.Scene, placements: Placement[]): PropBatches {
  const groups = new Map<string, Placement[]>();
  for (const p of placements) { const l = groups.get(p.kind) ?? []; l.push(p); groups.set(p.kind, l); }
  const meshes: THREE.Object3D[] = [];
  const spinners: Spinner[] = [];
  for (const [kind, list] of groups) {
    const { body, glow } = geoFor(kind);
    for (const [geo, material] of [[body, bodyMat], [glow, glowMat]] as const) {
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((p, i) => {
        _q.setFromAxisAngle(Y, p.rot); _p.set(p.x, p.y, p.z); _s.setScalar(p.s);
        im.setMatrixAt(i, _m.compose(_p, _q, _s));
        if (material === bodyMat) im.setColorAt(i, _c.setScalar(0.88 + ((i * 37 + p.x * 11) % 100) / 100 * 0.24));
      });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im); meshes.push(im);
    }
    if (kind === 'turbine') {
      if (!bladeGeo) {
        const bg = mergeParts([0, 1, 2].map(i => P(G.box(0.07, 0.62, 0.02), 0xf4f7fa, [Math.sin((i / 3) * Math.PI * 2) * -0.3, Math.cos((i / 3) * Math.PI * 2) * 0.3, 0], { r: [0, 0, (i / 3) * Math.PI * 2] })), false);
        bladeGeo = bg ? share(bg) : null;
      }
      if (bladeGeo) {
        const im = new THREE.InstancedMesh(bladeGeo, bodyMat, list.length);
        im.setColorAt(0, _c.setScalar(1));
        scene.add(im); spinners.push({ mesh: im, items: list });
      }
    }
  }
  const update = (t: number) => {
    for (const sp of spinners) {
      sp.items.forEach((p, i) => {
        _q.setFromAxisAngle(Y, p.rot);
        _q2.setFromAxisAngle(Z, t * 1.6 + i);
        _q.multiply(_q2);
        const hub = 1.5 * p.s;
        _p.set(p.x + Math.sin(p.rot) * 0.12 * p.s, p.y + hub, p.z + Math.cos(p.rot) * 0.12 * p.s);
        _s.setScalar(p.s);
        sp.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      sp.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  return { meshes, spinners, footprint: (k: string) => FOOT[k] ?? 0.3, update };
}
