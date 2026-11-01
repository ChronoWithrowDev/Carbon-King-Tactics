import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SIZE, type BattleMap, type TexKind, type ObstacleKind } from '../game/terrain';
import { mulberry, hashStr } from '../lib/rng';
import { TILE, gx, topYOf, G, mat, share } from './kit';
import { tileTexture, blobTexture } from './textures';
import { buildPropBatches, type Placement } from './props';

/**
 * Battle terrain: beveled grass/stone "slabs" (one InstancedMesh per texture) sitting on rock bodies
 * (one InstancedMesh per height 0-3). Props, obstacles and blob shadows are instanced too.
 */

export interface TerrainHandles { pickables: THREE.Object3D[]; update(t: number): void }

const SLAB_W = TILE * 0.985, BODY_W = TILE * 0.93, FLOOR = -1.0;
const OBST: Record<ObstacleKind, string[]> = {
  building: ['building', 'building2'], tower: ['tower', 'tower2', 'building2'], wall: ['wall'],
  rackbank: ['rackbank'], chalet: ['chalet'], mill: ['mill', 'stack'],
};

const slabMats = new Map<string, THREE.MeshStandardMaterial>();
const bodyMats = new Map<string, THREE.MeshStandardMaterial>();
const sideTex = (k: TexKind): TexKind => (k === 'snow' ? 'rock' : k === 'grass' ? 'dirt' : k === 'asphalt' ? 'concrete' : k);
const slabMat = (k: TexKind) => {
  let m = slabMats.get(k);
  if (!m) { m = share(new THREE.MeshStandardMaterial({ map: tileTexture(k), roughness: 0.9, metalness: 0.02 })); slabMats.set(k, m); }
  return m;
};
const bodyMat = (k: TexKind) => {
  const s = sideTex(k);
  let m = bodyMats.get(s);
  if (!m) { m = share(new THREE.MeshStandardMaterial({ map: tileTexture(s), vertexColors: true, roughness: 0.95, metalness: 0 })); bodyMats.set(s, m); }
  return m;
};

let slabGeo: THREE.BufferGeometry | null = null;
const bodyGeos: (THREE.BufferGeometry | undefined)[] = [];
function getSlabGeo() { return (slabGeo ??= share(new RoundedBoxGeometry(SLAB_W, 0.1, SLAB_W, 2, 0.035))); }
function getBodyGeo(h: number) {
  let g = bodyGeos[h];
  if (!g) {
    const H = -0.26 + h * 0.5 - 0.06 - FLOOR;
    g = share(new RoundedBoxGeometry(BODY_W, H, BODY_W, 2, 0.03));
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + H / 2) / H, v = 0.5 + 0.5 * t;   // darker toward the base
      col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bodyGeos[h] = g;
  }
  return g;
}

interface Cell { x: number; z: number; color: THREE.Color }

export function buildBattleTerrain(scene: THREE.Scene, bmap: BattleMap, nodeId: string): TerrainHandles {
  const { heights, blocked, water, city, road, theme } = bmap;
  const rnd = mulberry(hashStr('tiles' + nodeId));
  const pickables: THREE.Object3D[] = [];
  const topY = (x: number, z: number) => topYOf(heights, x, z);
  const isChasm = (x: number, z: number) => theme.profile === 'gorge' && x === 4 && z !== 4;
  const isBridge = (x: number, z: number) => theme.profile === 'gorge' && x === 4 && z === 4;

  const slabGroups = new Map<TexKind, Cell[]>();
  const bodyByH: Cell[][] = [[], [], [], []];
  const waterCells: Cell[] = [];
  const chasmCells: Cell[] = [];
  const sideC = new THREE.Color(theme.side), patchC = new THREE.Color(theme.patch);

  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const cell = (c: THREE.Color): Cell => ({ x, z, color: c });
    if (water[x][z]) { waterCells.push(cell(new THREE.Color(0x1f4e6e))); continue; }
    if (isChasm(x, z)) { chasmCells.push(cell(new THREE.Color(0x0b0d12))); continue; }
    const h = heights[x][z];
    let tex: TexKind = theme.tex;
    const c = new THREE.Color(theme.palette[Math.min(3, h)]);
    if (road[x][z]) { tex = 'asphalt'; c.setHex(0x3d444d); }
    else if (isBridge(x, z)) { tex = 'dirt'; c.setHex(0x7a5632); }
    else {
      c.offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.06);
      if (rnd() < 0.14) c.lerp(patchC, 0.6);
    }
    const list = slabGroups.get(tex) ?? [];
    list.push(cell(c)); slabGroups.set(tex, list);
    bodyByH[h].push(cell(sideC.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06)));
  }

  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  const instanced = (geo: THREE.BufferGeometry, material: THREE.Material, cells: Cell[], y: (c: Cell) => number, pick = false) => {
    if (!cells.length) return;
    const mesh = new THREE.InstancedMesh(geo, material, cells.length);
    cells.forEach((c, i) => {
      mesh.setMatrixAt(i, m4.compose(v3.set(gx(c.x), y(c), gx(c.z)), q0, s1));
      mesh.setColorAt(i, c.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.tiles = cells.map(c => ({ x: c.x, z: c.z }));
    scene.add(mesh);
    if (pick) pickables.push(mesh);
  };

  for (const [tex, cells] of slabGroups) instanced(getSlabGeo(), slabMat(tex), cells, c => topY(c.x, c.z) - 0.05, true);
  bodyByH.forEach((cells, h) => {
    if (!cells.length) return;
    const H = -0.26 + h * 0.5 - 0.06 - FLOOR;
    instanced(getBodyGeo(h), bodyMat(theme.tex), cells, () => FLOOR + H / 2);
  });

  // water: dark basin + gently bobbing translucent surface
  const waters: THREE.Mesh[] = [];
  const waterSurf = new THREE.MeshStandardMaterial({ color: 0x3aa0d8, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.85 });
  for (const c of waterCells) {
    const basin = new THREE.Mesh(G.box(BODY_W, 0.5, BODY_W), mat(0x1f4e6e, { rough: 0.9 }));
    basin.position.set(gx(c.x), -0.75, gx(c.z));
    basin.userData.tile = { x: c.x, z: c.z };
    const surf = new THREE.Mesh(G.plane(TILE * 0.96, TILE * 0.96), waterSurf);
    surf.rotation.x = -Math.PI / 2; surf.position.set(gx(c.x), -0.42, gx(c.z));
    scene.add(basin, surf); waters.push(surf); pickables.push(basin);
  }
  // chasm floor + bridge rails
  for (const c of chasmCells) {
    const pit = new THREE.Mesh(G.box(TILE, 0.1, TILE), mat(0x0b0d12, { rough: 1, metal: 0 }));
    pit.position.set(gx(c.x), -1.3, gx(c.z));
    scene.add(pit);
  }
  if (theme.profile === 'gorge') {
    for (const dz of [-0.5, 0.5]) {
      const rail = new THREE.Mesh(G.box(TILE, 0.16, 0.05), mat(0x4a3420, { rough: 0.9, metal: 0 }));
      rail.position.set(gx(4), topY(4, 4) + 0.12, gx(4) + dz);
      scene.add(rail);
    }
  }
  // road lane stripes
  if (theme.road) {
    const stripes = new THREE.InstancedMesh(G.box(0.5, 0.012, 0.07), new THREE.MeshBasicMaterial({ color: 0xe8d27a }), SIZE);
    for (let x = 0; x < SIZE; x++) stripes.setMatrixAt(x, m4.compose(v3.set(gx(x), topY(x, 4) + 0.006, gx(4)), q0, s1));
    scene.add(stripes);
  }

  // obstacles + props (instanced, with blob shadows)
  const placements: Placement[] = [];
  const shadows: { x: number; y: number; z: number; r: number }[] = [];
  const rp = mulberry(hashStr('props' + nodeId));
  const taken = new Set<string>();
  if (theme.obstacle) {
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      if (!city[x][z]) continue;
      const kinds = OBST[theme.obstacle];
      const kind = kinds[Math.floor(rp() * kinds.length)];
      placements.push({ kind, x: gx(x), y: topY(x, z), z: gx(z), rot: Math.floor(rp() * 4) * Math.PI / 2 + (rp() - 0.5) * 0.12, s: 0.95 + rp() * 0.15 });
      taken.add(`${x},${z}`);
    }
  }
  let placed = 0, guard = 0;
  while (placed < theme.propCount && guard++ < 140) {
    const x = Math.floor(rp() * SIZE), z = Math.floor(rp() * SIZE);
    if (z <= 1 || z >= SIZE - 2 || blocked[x][z] || road[x][z] || isChasm(x, z) || isBridge(x, z) || taken.has(`${x},${z}`)) continue;
    taken.add(`${x},${z}`);
    const kind = theme.props[Math.floor(rp() * theme.props.length)];
    placements.push({ kind, x: gx(x) + (rp() - 0.5) * 0.5, y: topY(x, z), z: gx(z) + (rp() - 0.5) * 0.5, rot: rp() * Math.PI * 2, s: 0.85 + rp() * 0.5 });
    placed++;
  }
  const props = buildPropBatches(scene, placements);
  for (const p of placements) shadows.push({ x: p.x, y: p.y, z: p.z, r: props.footprint(p.kind) * p.s });
  if (shadows.length) {
    const blob = new THREE.InstancedMesh(G.circle(1, 20), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.7, depthWrite: false }), shadows.length);
    const qf = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    shadows.forEach((s, i) => blob.setMatrixAt(i, m4.compose(v3.set(s.x, s.y + 0.014, s.z), qf, new THREE.Vector3(s.r * 1.25, s.r * 1.25, 1))));
    blob.renderOrder = 1;
    scene.add(blob);
  }

  return {
    pickables,
    update(t: number) {
      props.update(t);
      waters.forEach((w, i) => { w.position.y = -0.42 + Math.sin(t * 1.6 + i) * 0.015; });
    },
  };
}
