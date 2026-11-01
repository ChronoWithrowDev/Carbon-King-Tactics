import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Grid constants + shared geometry/material caches. Everything here is reused across units and battles. */

export const TILE = 1.12;
export const gx = (i: number) => (i - 4) * TILE;
export const topYOf = (heights: number[][], x: number, z: number) => -0.26 + heights[x][z] * 0.5;

/** Marks a geometry, material, or texture as shared across scenes so disposeScene leaves it intact. */
export function share<T extends { userData: Record<string, unknown> }>(obj: T): T {
  obj.userData.shared = true;
  return obj;
}

const geos = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geos.get(key) as T | undefined;
  if (!g) { g = share(make()); geos.set(key, g); }
  return g;
}

export const G = {
  box: (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  sph: (r: number, ws = 10, hs = 8) => cached(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  cone: (r: number, h: number, s = 8) => cached(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  torus: (R: number, r: number, rs = 8, ts = 22) => cached(`t${R},${r},${rs},${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts)),
  dodeca: (r: number) => cached(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  ico: (r: number, d = 0) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  plane: (w: number, h: number) => cached(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
  circle: (r: number, s = 24) => cached(`o${r},${s}`, () => new THREE.CircleGeometry(r, s)),
  ring: (a: number, b: number, s = 32) => cached(`r${a},${b},${s}`, () => new THREE.RingGeometry(a, b, s)),
  arc: (a: number, b: number, s = 22, start = -1.25, len = 2.5) => cached(`arc${a},${b},${s},${start},${len}`, () => new THREE.RingGeometry(a, b, s, 1, start, len)),
};

export interface MatOpts {
  metal?: number; rough?: number; emissive?: number | string; ei?: number; flat?: boolean;
  transparent?: boolean; opacity?: number; side?: THREE.Side; depthWrite?: boolean;
}
const mats = new Map<string, THREE.Material>();

export function mat(color: number | string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `m${color}|${o.rough ?? 0.65}|${o.metal ?? 0.12}|${o.emissive ?? 0}|${o.ei ?? 1}|${o.flat ?? false}|${o.transparent ?? false}|${o.opacity ?? 1}|${o.side ?? 0}|${o.depthWrite ?? true}`;
  let m = mats.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = share(new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.65, metalness: o.metal ?? 0.12,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: o.flat ?? false,
      transparent: o.transparent ?? false, opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true,
    }));
    mats.set(key, m);
  }
  return m;
}

export function basic(color: number | string, o: { transparent?: boolean; opacity?: number; side?: THREE.Side; depthWrite?: boolean; additive?: boolean } = {}): THREE.MeshBasicMaterial {
  const key = `bm${color}|${o.transparent ?? false}|${o.opacity ?? 1}|${o.side ?? 0}|${o.depthWrite ?? true}|${o.additive ?? false}`;
  let m = mats.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = share(new THREE.MeshBasicMaterial({
      color, transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite ?? true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !o.additive,
    }));
    mats.set(key, m);
  }
  return m;
}

/* ---- merge many small colored parts into one vertex-colored geometry (1 draw call) ---- */

export interface Part {
  g: THREE.BufferGeometry; c: number | string;
  p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number];
  glow?: boolean;
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

export function mergeParts(parts: Part[], glow = false): THREE.BufferGeometry | null {
  const list = parts.filter(p => !!p.glow === glow);
  if (!list.length) return null;
  const col = new THREE.Color();
  const tmpGeos = list.map(p => {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    _e.set(p.r?.[0] ?? 0, p.r?.[1] ?? 0, p.r?.[2] ?? 0);
    _q.setFromEuler(_e);
    _v.set(p.p?.[0] ?? 0, p.p?.[1] ?? 0, p.p?.[2] ?? 0);
    _s.set(p.s?.[0] ?? 1, p.s?.[1] ?? 1, p.s?.[2] ?? 1);
    g.applyMatrix4(_m.compose(_v, _q, _s));
    col.set(p.c);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(tmpGeos, false) as THREE.BufferGeometry | null;
  tmpGeos.forEach(g => g.dispose());
  return merged;
}

function disposeMat(m: THREE.Material | undefined) {
  if (!m || m.userData?.shared) return;
  m.dispose();
}

/** Disposes only per-scene GPU resources, preserving shared geometry/material/texture caches. */
export function disposeSceneObjects(scene: THREE.Scene) {
  scene.traverse(o => {
    const sp = o as THREE.Sprite;
    if (sp.isSprite) {
      const sm = sp.material as THREE.SpriteMaterial;
      if (sm.map && !sm.map.userData?.shared) sm.map.dispose();
      disposeMat(sm);
      return;
    }
    const mesh = o as THREE.Mesh;
    (mesh as THREE.InstancedMesh).dispose?.();
    if (mesh.geometry && !mesh.geometry.userData?.shared) mesh.geometry.dispose();
    const mt = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mt)) mt.forEach(disposeMat);
    else disposeMat(mt);
  });
}
