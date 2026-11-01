import * as THREE from 'three';
import { SIZE, type BattleMap } from '../game/terrain';
import type { WeaponType } from '../game/jobs';
import { createStageKit, type StageKit } from '../three/stage';
import { TILE, gx, topYOf, G, mat, share } from '../three/kit';
import {
  buildCharacter, updateRig, rigSwing, rigHit, rigFreeze, rigDie, disposeRig, ringMats, speciesFor, hatFor, type CharRig,
} from '../three/characters';
import { lerpAngle, clamp } from '../lib/rng';
import { sound, type AbilitySound, type FootstepSurface } from '../lib/sound';
import type { BU } from './types';

/**
 * Owns everything 3D about a battle: camera, unit rigs, movement/attack animation, range highlights,
 * hover outline, picking and VFX triggers. React only talks to it through this small API.
 */

export type HiKind = 'move' | 'attack' | 'ally';
export interface HiCell { x: number; z: number; k: HiKind }
interface HitOpts { blocked?: boolean; heavy?: boolean; attackerUid?: string }
interface Plate { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; sprite: THREE.Sprite }
interface Step { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number; dur: number; hop: boolean }
interface Entry {
  uid: string; rig: CharRig; tile: { x: number; z: number }; queue: { x: number; z: number }[]; step: Step | null;
  faceT: number; sig: string; plate: Plate; pick: THREE.Mesh; active: boolean; graveOk: boolean;
}

const HI_COLOR: Record<HiKind, number> = { move: 0x22e0d4, attack: 0xff3b5c, ally: 0x5cf08a };
const pickMat = share(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

function frameGeo(w: number, t: number) {
  const h = w / 2, i = h - t;
  const s = new THREE.Shape();
  s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.lineTo(-h, -h);
  const hole = new THREE.Path();
  hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
  s.holes.push(hole);
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

function makePlate(): Plate {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.5, 0.375, 1); sprite.position.y = 2.0; sprite.renderOrder = 10;
  return { cv, cx: cv.getContext('2d')!, tex, sprite };
}
function drawPlate(p: Plate, u: BU) {
  const { cx } = p;
  cx.clearRect(0, 0, 256, 64);
  cx.font = 'bold 24px system-ui'; cx.textAlign = 'center';
  cx.shadowColor = '#000'; cx.shadowBlur = 6; cx.fillStyle = u.team === 'player' ? '#e8fbff' : '#ffd9de';
  const label = u.team === 'enemy' && !u.scanned ? `${u.name}` : `${u.name}  Lv${u.level}`;
  cx.fillText(label.length > 24 ? label.slice(0, 24) : label, 128, 26);
  cx.shadowBlur = 0;
  cx.fillStyle = 'rgba(4,10,20,.8)'; cx.fillRect(38, 36, 180, 12);
  const show = u.team === 'player' || u.scanned, f = Math.max(0, u.hp / u.maxHp);
  cx.fillStyle = !show ? '#64748b' : f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171';
  cx.fillRect(40, 38, 176 * (show ? f : 1), 8);
  if (u.shield > 0) { cx.fillStyle = '#7dd3fc'; cx.fillRect(40, 38, Math.min(176, u.shield * 2), 3); }
  cx.strokeStyle = u.team === 'player' ? '#2de2d0' : '#ff4d5e'; cx.lineWidth = 1.5; cx.strokeRect(38, 36, 180, 12);
  p.tex.needsUpdate = true;
}

export class BattleScene {
  readonly kit: StageKit;
  onTile?: (x: number, z: number) => void;
  onHover?: (t: { x: number; z: number } | null) => void;

  private heights: number[][];
  private road: boolean[][];
  private water: boolean[][];
  private terrainTex: BattleMap['theme']['tex'];
  private entries = new Map<string, Entry>();
  private graves = new Map<string, THREE.Group>();
  private wallMeshes = new Map<string, THREE.Mesh>();
  private timeline: { at: number; fn: () => void }[] = [];
  private theta = Math.PI / 4; private thetaT = Math.PI / 4; private radius = 13.5; private radiusT = 13.5;
  private fill: THREE.InstancedMesh; private frames: THREE.InstancedMesh;
  private hoverFrame: THREE.Mesh; private activeFrame: THREE.Mesh;
  private fillMat: THREE.MeshBasicMaterial;
  private hoverTile: { x: number; z: number } | null = null;
  private hoverReq: { x: number; y: number } | null = null;
  private lastHoverX = -999; private lastHoverY = -999;
  private dragging = false; private moved = 0; private px = 0;
  private ray = new THREE.Raycaster(); private ndc = new THREE.Vector2();
  private pickObjs: THREE.Object3D[] = [];
  private mp = new THREE.Vector3(); private tp = new THREE.Vector3();
  private vFrom = new THREE.Vector3(); private vTo = new THREE.Vector3();
  private scCol = new THREE.Color();
  private m4 = new THREE.Matrix4(); private q0 = new THREE.Quaternion(); private one = new THREE.Vector3(1, 1, 1); private pv = new THREE.Vector3();
  private cleanup: (() => void)[] = [];

  constructor(el: HTMLElement, bmap: BattleMap, nodeId: string) {
    this.heights = bmap.heights;
    this.road = bmap.road;
    this.water = bmap.water;
    this.terrainTex = bmap.theme.tex;
    this.kit = createStageKit(el, bmap, nodeId);
    const { scene, renderer } = this.kit;

    // range highlight layers: translucent raised quads + crisp frames (instanced, recolored per cell)
    this.fillMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false });
    this.fill = new THREE.InstancedMesh(new THREE.PlaneGeometry(TILE * 0.9, TILE * 0.9).rotateX(-Math.PI / 2), this.fillMat, SIZE * SIZE);
    this.frames = new THREE.InstancedMesh(frameGeo(TILE * 0.92, 0.035), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), SIZE * SIZE);
    for (const m of [this.fill, this.frames]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 3; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); }
    const gold = (c: number, w: number, t: number) => new THREE.Mesh(frameGeo(w, t), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, depthWrite: false, transparent: true }));
    this.hoverFrame = gold(0xffd24a, TILE * 0.98, 0.03); this.activeFrame = gold(0xffb02e, TILE * 1.0, 0.05);
    for (const f of [this.hoverFrame, this.activeFrame]) { f.visible = false; f.renderOrder = 4; scene.add(f); }

    // input
    const cv = renderer.domElement;
    const down = (e: PointerEvent) => { this.dragging = true; this.moved = 0; this.px = e.clientX; };
    const move = (e: PointerEvent) => {
      if (this.dragging) {
        const dx = e.clientX - this.px; this.px = e.clientX; this.moved += Math.abs(dx);
        this.thetaT += dx * 0.008; this.theta += dx * 0.008;
      } else if (e.target === cv && Math.abs(e.clientX - this.lastHoverX) + Math.abs(e.clientY - this.lastHoverY) >= 2) {
        this.lastHoverX = e.clientX; this.lastHoverY = e.clientY;
        this.hoverReq = { x: e.clientX, y: e.clientY };
      }
    };
    const up = () => { this.dragging = false; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.radiusT = clamp(this.radiusT + e.deltaY * 0.012, 8, 24); };
    const click = (e: MouseEvent) => {
      if (this.moved > 6) return;
      const t = this.pick(e.clientX, e.clientY);
      if (t) { sound.playUiClick(); this.onTile?.(t.x, t.z); }
    };
    const leave = () => { this.hoverReq = null; this.setHover(null); };
    cv.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('click', click); cv.addEventListener('pointerleave', leave);
    this.cleanup.push(() => {
      cv.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      cv.removeEventListener('wheel', wheel); cv.removeEventListener('click', click); cv.removeEventListener('pointerleave', leave);
    });
    this.kit.setFrame(this.frame);
  }

  private topY(x: number, z: number) { return topYOf(this.heights, x, z); }
  private footstepSurface(x: number, z: number): FootstepSurface {
    if (this.road[x]?.[z]) return 'asphalt';
    if (this.water[x]?.[z]) return 'dirt';
    switch (this.terrainTex) {
      case 'grass': return 'grass';
      case 'concrete': return 'concrete';
      case 'asphalt': return 'asphalt';
      case 'rock': return 'gravel';
      case 'snow': return 'snow';
      case 'sand': return 'sand';
      default: return 'dirt';
    }
  }
  private later(ms: number, fn: () => void) { this.timeline.push({ at: performance.now() + ms, fn }); }

  /* ---------------------------------- camera / input ---------------------------------- */

  rotate(d: number) { this.thetaT += d; }
  zoom(d: number) { this.radiusT = clamp(this.radiusT + d, 8, 24); }

  private pick(cx: number, cy: number): { x: number; z: number } | null {
    const r = this.kit.renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.kit.camera);
    const objs = this.pickObjs;
    objs.length = 0;
    const tp = this.kit.terrain.pickables;
    for (let i = 0; i < tp.length; i++) objs.push(tp[i]);
    this.entries.forEach(e => objs.push(e.pick));
    this.graves.forEach(g => objs.push(g.userData.pick as THREE.Object3D));
    const hits = this.ray.intersectObjects(objs, false);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud.tiles && h.instanceId !== undefined) return ud.tiles[h.instanceId];
      if (ud.tile) return ud.tile;
    }
    return null;
  }

  private setHover(t: { x: number; z: number } | null) {
    if (t?.x === this.hoverTile?.x && t?.z === this.hoverTile?.z) return;
    this.hoverTile = t;
    this.hoverFrame.visible = !!t;
    if (t) {
      this.hoverFrame.position.set(gx(t.x), this.topY(t.x, t.z) + 0.05, gx(t.z));
    }
    this.onHover?.(t);
  }

  project(x: number, z: number, dy = 2): { x: number; y: number } {
    const v = this.pv.set(gx(x), this.topY(x, z) + dy, gx(z)).project(this.kit.camera);
    return { x: (v.x * 0.5 + 0.5) * this.kit.el.clientWidth, y: (-v.y * 0.5 + 0.5) * this.kit.el.clientHeight };
  }

  /* ---------------------------------- highlights ---------------------------------- */

  setHighlights(cells: HiCell[], active: { x: number; z: number } | null) {
    const n = Math.min(cells.length, SIZE * SIZE), col = this.scCol;
    for (let i = 0; i < n; i++) {
      const c = cells[i], y = this.topY(c.x, c.z);
      this.fill.setMatrixAt(i, this.m4.compose(this.pv.set(gx(c.x), y + 0.035, gx(c.z)), this.q0, this.one));
      this.frames.setMatrixAt(i, this.m4.compose(this.pv.set(gx(c.x), y + 0.042, gx(c.z)), this.q0, this.one));
      col.setHex(HI_COLOR[c.k]);
      this.fill.setColorAt(i, col); this.frames.setColorAt(i, col);
    }
    this.fill.count = n; this.frames.count = n;
    this.fill.instanceMatrix.needsUpdate = this.frames.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
    if (this.frames.instanceColor) this.frames.instanceColor.needsUpdate = true;
    this.activeFrame.visible = !!active;
    if (active) this.activeFrame.position.set(gx(active.x), this.topY(active.x, active.z) + 0.05, gx(active.z));
  }

  setWalls(walls: { x: number; z: number }[]) {
    const keep = new Set(walls.map(w => `${w.x},${w.z}`));
    for (const w of walls) {
      const k = `${w.x},${w.z}`;
      if (this.wallMeshes.has(k)) continue;
      const m = new THREE.Mesh(G.box(TILE * 0.9, 1.25, TILE * 0.9), mat(0x67e8f9, { transparent: true, opacity: 0.5, emissive: 0x0e7490, ei: 0.8, rough: 0.3, depthWrite: false }));
      m.position.set(gx(w.x), this.topY(w.x, w.z) + 0.62, gx(w.z));
      m.userData.tile = { x: w.x, z: w.z };
      this.kit.scene.add(m); this.wallMeshes.set(k, m);
      this.kit.vfx.ring(m.position.x, m.position.y - 0.5, m.position.z, 0x67e8f9, 2);
    }
    for (const [k, m] of [...this.wallMeshes]) if (!keep.has(k)) { this.kit.scene.remove(m); this.wallMeshes.delete(k); }
  }

  /* ---------------------------------- unit sync ---------------------------------- */

  syncUnits(units: BU[], activeUid: string | null, victory = false) {
    const now = performance.now();
    for (const u of units) {
      let e = this.entries.get(u.uid);
      if (!u.alive) {
        if (e && !e.rig.anim.deadT0) {
          rigDie(e.rig, now);
          e.graveOk = u.team === 'player' && u.moteLife === undefined;
          this.kit.vfx.sparksAt(e.rig.root.position.x, e.rig.root.position.y + 0.8, e.rig.root.position.z, 16, u.team === 'player' ? 0x2de2d0 : 0xff6b7a, 3.2);
          this.kit.vfx.ring(e.rig.root.position.x, e.rig.root.position.y, e.rig.root.position.z, u.team === 'player' ? 0x2de2d0 : 0xff4d5e, 1.8);
        }
        continue;
      }
      if (!e) {
        const old = this.graves.get(u.uid);
        if (old) { this.kit.scene.remove(old); this.graves.delete(u.uid); this.kit.vfx.ring(old.position.x, old.position.y, old.position.z, 0x5cf08a, 2.4); }
        const rig = buildCharacter({
          uid: u.uid, team: u.team, color: u.color, species: speciesFor(u.charId, u.icon), jobId: u.jobId,
          wType: u.wType, hasShield: u.hasShield, hat: hatFor(u.charId, u.icon),
        });
        rig.root.position.set(gx(u.x), this.topY(u.x, u.z), gx(u.z));
        rig.root.rotation.y = u.team === 'player' ? Math.PI : 0;
        const plate = makePlate(); rig.root.add(plate.sprite);
        const pick = new THREE.Mesh(G.cyl(0.42, 0.42, 1.7, 8), pickMat);
        pick.position.y = 0.85; pick.visible = false; pick.userData.tile = { x: u.x, z: u.z }; rig.root.add(pick);
        this.kit.scene.add(rig.root);
        e = { uid: u.uid, rig, tile: { x: u.x, z: u.z }, queue: [], step: null, faceT: rig.root.rotation.y, sig: '', plate, pick, active: false, graveOk: false };
        this.entries.set(u.uid, e);
      }
      if (e.rig.anim.deadT0) continue;
      if (e.tile.x !== u.x || e.tile.z !== u.z) { e.tile = { x: u.x, z: u.z }; e.pick.userData.tile = e.tile; }
      e.active = u.uid === activeUid;
      e.rig.bubble.visible = u.shield > 0;
      e.rig.shell.visible = u.suit > 0;
      e.rig.anim.guard = u.defUp > 0;
      e.rig.anim.aim = u.steady;
      e.rig.anim.victory = victory && u.team === 'player';
      const sig = `${u.hp}|${u.maxHp}|${u.shield}|${u.scanned}|${u.name}|${u.level}`;
      if (sig !== e.sig) { e.sig = sig; drawPlate(e.plate, u); }
      if (e.active && !victory && !e.step && !e.queue.length) {   // idle: square up to the nearest foe
        let best: BU | null = null, bd = 1e9;
        for (const f of units) if (f.alive && f.team !== u.team) { const d = Math.abs(f.x - u.x) + Math.abs(f.z - u.z); if (d < bd) { bd = d; best = f; } }
        if (best) e.faceT = Math.atan2(gx(best.x) - gx(u.x), gx(best.z) - gx(u.z));
      }
    }
  }

  /** Called BEFORE the logical position changes so the rig walks/hops along the path. */
  queueMove(uid: string, path: { x: number; z: number }[]) {
    const e = this.entries.get(uid);
    if (e) e.queue = path.slice();
  }

  /* ---------------------------------- combat animation ---------------------------------- */

  /** Plays the attack animation and returns the delay (ms) until the hit should land. */
  attack(uid: string, wType: WeaponType, tx: number, tz: number): number {
    const e = this.entries.get(uid);
    if (!e) return 200;
    const now = performance.now(), vfx = this.kit.vfx;
    const ax = e.rig.root.position.x, ay = e.rig.root.position.y, az = e.rig.root.position.z;
    const wx = gx(tx), wy = this.topY(tx, tz) + 0.85, wz = gx(tz);
    const yaw = Math.atan2(wx - ax, wz - az);
    e.faceT = yaw;
    e.rig.root.rotation.y = lerpAngle(e.rig.root.rotation.y, yaw, 0.55);

    const spark = (color: number, n = 12) => vfx.sparksAt(wx, wy, wz, n, color, 2.8);
    const muzzleShot = (hex: number, thick: number, sniper = false) => {
      e.rig.muzzle.getWorldPosition(this.mp);
      vfx.flash(this.mp, hex);
      vfx.shellEject(this.mp, yaw);
      if (sniper) {
        vfx.thrustWave(this.mp, this.tp.set(wx, wy, wz), 0xfff3b0);
        vfx.shake = Math.max(vfx.shake, 0.14);
      } else {
        vfx.line(this.mp, this.tp.set(wx, wy, wz), hex, thick, 0.11);
        vfx.shake = Math.max(vfx.shake, 0.05);
      }
      spark(0xffd36a, sniper ? 16 : 9);
    };

    switch (wType) {
      case 'Sword':
        rigSwing(e.rig, 'melee', now);
        vfx.dust(ax, ay, az, 3);
        sound.playSwordSlash();
        this.later(190, () => vfx.slashArc(ax + Math.sin(yaw) * 0.36, ay + 0.88, az + Math.cos(yaw) * 0.36, yaw, 0.28, e.rig.spec.team === 'player' ? 0x9bf8ff : 0xff9aa8, 1.08));
        this.later(245, () => { spark(0xfff0b0, 14); vfx.shake = Math.max(vfx.shake, 0.07); });
        return 255;
      case 'Mace':
        rigSwing(e.rig, 'slam', now);
        vfx.dust(ax, ay, az, 3);
        this.later(250, () => {
          vfx.slashArc(ax + Math.sin(yaw) * 0.35, ay + 0.95, az + Math.cos(yaw) * 0.35, yaw, 1.48, 0xffc86a, 1.05);
          sound.playMaceSlam();
        });
        this.later(310, () => {
          spark(0xffc27a, 16);
          vfx.dust(wx, wy - 0.85, wz, 5);
          vfx.ring(wx, wy - 0.85, wz, 0xffb35a, 1.9);
          vfx.shake = Math.max(vfx.shake, 0.13);
        });
        return 320;
      case 'Spear':
        rigSwing(e.rig, 'thrust', now);
        vfx.dust(ax, ay, az, 3);
        sound.playSpearThrust();
        this.later(210, () => {
          e.rig.muzzle.getWorldPosition(this.mp);
          vfx.thrustWave(this.vFrom.set(ax + Math.sin(yaw) * 0.25, ay + 0.88, az + Math.cos(yaw) * 0.25), this.tp.set(wx, wy, wz), 0xe0f7ff);
          spark(0xffffff, 13);
          vfx.shake = Math.max(vfx.shake, 0.08);
        });
        return 235;
      case 'DEW':
        rigSwing(e.rig, 'gun', now, 1);
        sound.playEnergyBeam();
        this.later(40, () => { e.rig.muzzle.getWorldPosition(this.mp); vfx.flash(this.mp, 0x4fe8ff); });
        this.later(115, () => {
          e.rig.muzzle.getWorldPosition(this.mp);
          vfx.beam(this.mp, this.tp.set(wx, wy, wz));
          vfx.ring(wx, wy - 0.85, wz, 0x4fe8ff, 1.6);
          vfx.shake = Math.max(vfx.shake, 0.09);
        });
        return 190;
      default: {
        const sniper = wType === 'LongRifle';
        const burst = wType === 'SMG' ? 3 : wType === 'Assault' ? 2 : 1;
        rigSwing(e.rig, 'gun', now, burst);
        for (let i = 0; i < burst; i++) {
          this.later(70 + i * 110, () => {
            sound.playGunshot(wType as 'Pistol' | 'SMG' | 'Assault' | 'LongRifle');
            muzzleShot(0xfff2b0, 0.04, sniper);
          });
        }
        return 110 + (burst - 1) * 110;
      }
    }
  }

  /** High-impact aerial leap / dash strike (Mesa Drop, Dash Slash). Returns ms until landing impact. */
  leapAttack(uid: string, tx: number, tz: number, color = 0x5cf0c8): number {
    const e = this.entries.get(uid);
    if (!e) return 300;
    const now = performance.now(), vfx = this.kit.vfx;
    const ax = e.rig.root.position.x, ay = e.rig.root.position.y, az = e.rig.root.position.z;
    const wx = gx(tx), wy = this.topY(tx, tz), wz = gx(tz);
    const yaw = Math.atan2(wx - ax, wz - az);
    e.faceT = yaw; e.rig.root.rotation.y = yaw;
    rigSwing(e.rig, 'leap', now);
    vfx.dust(ax, ay, az, 6);
    vfx.ring(ax, ay, az, color, 1.8);
    this.later(300, () => vfx.slashArc(wx - Math.sin(yaw) * 0.2, wy + 1.0, wz - Math.cos(yaw) * 0.2, yaw, 1.4, color, 1.25));
    this.later(420, () => {
      vfx.ring(wx, wy, wz, color, 2.8);
      vfx.dust(wx, wy, wz, 7);
      vfx.sparksAt(wx, wy + 0.6, wz, 20, color, 3.6);
      vfx.shake = Math.max(vfx.shake, 0.2);
    });
    return 430;
  }

  /** Secondary beam/arc burst on extra targets hit by an AoE or line ability. */
  aoeHitFx(fromX: number, fromZ: number, tx: number, tz: number, flash = false) {
    const fx = gx(fromX), fy = this.topY(fromX, fromZ) + 0.9, fz = gx(fromZ);
    const wx = gx(tx), wy = this.topY(tx, tz), wz = gx(tz);
    if (flash) this.kit.vfx.beam(this.vFrom.set(fx, fy, fz), this.vTo.set(wx, wy + 0.85, wz), 0x22d3ee);
    this.kit.vfx.ring(wx, wy, wz, flash ? 0x22d3ee : 0xffb35a, 1.9);
  }

  cast(uid: string, color = 0x2de2d0, audio: AbilitySound = 'buff') {
    const e = this.entries.get(uid);
    if (!e) return;
    const p = e.rig.root.position;
    sound.playAnimePowerUp(audio);
    rigSwing(e.rig, 'cast', performance.now());
    this.kit.vfx.ring(p.x, p.y, p.z, color, 2.6);
    this.later(300, () => this.kit.vfx.ring(p.x, p.y, p.z, color, 3.2));
    this.kit.vfx.sparksAt(p.x, p.y + 1, p.z, 16, color, 2);
  }

  hit(uid: string, fromX: number, fromZ: number, opts?: HitOpts) {
    const e = this.entries.get(uid);
    if (!e) return;
    const now = performance.now(), p = e.rig.root.position, vfx = this.kit.vfx;
    const blocked = !!opts?.blocked, heavy = !!opts?.heavy;
    rigHit(e.rig, p.x - gx(fromX), p.z - gx(fromZ), now, blocked, heavy);
    if (heavy && opts?.attackerUid) {
      const att = this.entries.get(opts.attackerUid);
      if (att) rigFreeze(att.rig, 55, now);
    }
    if (blocked) {
      sound.playShieldDeflect();
      vfx.shieldFlare(p.x, p.y, p.z, gx(fromX), gx(fromZ), 0x38bdf8);
    } else {
      sound.playHitImpact(heavy);
      vfx.sparksAt(p.x, p.y + 0.9, p.z, heavy ? 20 : 12, heavy ? 0xffd24a : 0xffe08a, heavy ? 3.8 : 2.8);
      if (heavy) {
        vfx.ring(p.x, p.y, p.z, 0xffd24a, 2.2);
        vfx.dust(p.x, p.y, p.z, 4);
        vfx.shake = Math.max(vfx.shake, 0.16);
      }
    }
  }

  healFx(x: number, z: number) { const y = this.topY(x, z); this.kit.vfx.ring(gx(x), y, gx(z), 0x5cf08a, 2.2); this.kit.vfx.sparksAt(gx(x), y + 0.6, gx(z), 12, 0x7dffa8, 1.5); }
  buffFx(x: number, z: number, color = 0xfacc15) { const y = this.topY(x, z); this.kit.vfx.ring(gx(x), y, gx(z), color, 2); this.kit.vfx.sparksAt(gx(x), y + 1, gx(z), 8, color, 1.4); }

  /** artillery / airstrike: tracer from the sky, explosion on impact. Returns impact delay (ms). */
  strike(tx: number, tz: number, air: boolean): number {
    const x = gx(tx), z = gx(tz), y = this.topY(tx, tz), vfx = this.kit.vfx;
    sound.playExplosion(air);
    vfx.line(this.vFrom.set(x + (air ? -10 : 0), air ? 9 : 13, z + (air ? -10 : 0)), this.vTo.set(x, y, z), air ? 0xffe0a0 : 0xff9a4a, 0.09, 0.4);
    this.later(380, () => vfx.explosion(x, y, z));
    if (air) { this.later(480, () => vfx.explosion(x + TILE, y, z)); this.later(560, () => vfx.explosion(x - TILE, y, z)); }
    return 420;
  }

  /* ---------------------------------- frame ---------------------------------- */

  private frame = (t: number, dt: number, now: number) => {
    const cam = this.kit.camera, k = Math.min(1, dt * 8), sh = this.kit.vfx.shake;
    this.theta += (this.thetaT - this.theta) * k;
    this.radius += (this.radiusT - this.radius) * k;
    const sway = Math.sin(t * 0.13) * 0.018;
    const baseH = this.radius > 13.5 ? 11 - (this.radius - 13.5) * 0.55 : 11;
    cam.position.set(
      Math.sin(this.theta + sway) * this.radius + (Math.random() - 0.5) * sh,
      baseH + Math.sin(t * 0.21) * 0.08 + (Math.random() - 0.5) * sh,
      Math.cos(this.theta + sway) * this.radius + (Math.random() - 0.5) * sh * 0.5);
    cam.lookAt(0, -0.3, 0);

    for (let i = this.timeline.length - 1; i >= 0; i--) {
      if (this.timeline[i].at <= now) { const f = this.timeline[i].fn; this.timeline.splice(i, 1); f(); }
    }
    let hasDead = false;
    this.entries.forEach(e => { this.stepEntry(e, dt, now, t); if (e.rig.anim.dead) hasDead = true; });
    if (hasDead) {
      for (const e of [...this.entries.values()]) if (e.rig.anim.dead) this.removeEntry(e);
    }

    this.fillMat.opacity = 0.3 + Math.sin(t * 4) * 0.05;
    this.activeFrame.scale.setScalar(1 + Math.sin(t * 5) * 0.03);
    if (this.hoverReq && !this.dragging) { this.setHover(this.pick(this.hoverReq.x, this.hoverReq.y)); this.hoverReq = null; }
  };

  private stepEntry(e: Entry, dt: number, now: number, t: number) {
    const r = e.rig, root = r.root;
    if (!r.anim.deadT0) {
      if (!e.step && e.queue.length) {
        const n = e.queue.shift()!;
        const tx = gx(n.x), tz = gx(n.z), ty = this.topY(n.x, n.z);
        const hop = Math.abs(ty - root.position.y) > 0.2, dur = hop ? 0.36 : 0.21;
        e.step = { fx: root.position.x, fy: root.position.y, fz: root.position.z, tx, ty, tz, t: 0, dur, hop };
        e.faceT = Math.atan2(tx - root.position.x, tz - root.position.z);
        if (hop) { r.anim.hopT0 = now; r.anim.hopDur = dur * 1000; }
      }
      if (e.step) {
        const s = e.step; s.t += dt;
        const p = Math.min(1, s.t / s.dur);
        root.position.set(s.fx + (s.tx - s.fx) * p, s.fy + (s.ty - s.fy) * p + (s.hop ? Math.sin(p * Math.PI) * (0.32 + Math.abs(s.ty - s.fy) * 0.5) : 0), s.fz + (s.tz - s.fz) * p);
        r.anim.moving = true;
        if (p >= 1) {
          root.position.set(s.tx, s.ty, s.tz);
          this.kit.vfx.dust(s.tx, s.ty, s.tz, s.hop ? 5 : 2);
          const tx = Math.round(s.tx / TILE + 4), tz = Math.round(s.tz / TILE + 4);
          sound.playFootstep(this.footstepSurface(tx, tz), s.hop ? 1.2 : 1);
          e.step = null;
        }
      } else {
        r.anim.moving = false;
        const tx = gx(e.tile.x), tz = gx(e.tile.z), ty = this.topY(e.tile.x, e.tile.z);
        if (Math.abs(root.position.x - tx) + Math.abs(root.position.z - tz) + Math.abs(root.position.y - ty) > 0.03) {
          this.kit.vfx.sparksAt(root.position.x, root.position.y + 0.8, root.position.z, 8, 0x93c5fd);   // teleport
          root.position.set(tx, ty, tz);
          this.kit.vfx.sparksAt(tx, ty + 0.8, tz, 10, 0x93c5fd);
        }
      }
      root.rotation.y = lerpAngle(root.rotation.y, e.faceT, Math.min(1, dt * 13));
      r.ring.material = e.active ? ringMats.active : ringMats[r.spec.team];
      const pulse = e.active ? 1.18 + Math.sin(t * 5) * 0.08 : 1;
      r.ring.scale.set(pulse, pulse, 1); r.ring.rotation.z += dt * (e.active ? 0.9 : 0.3);
    }
    updateRig(r, t, dt, now);
  }

  private removeEntry(e: Entry) {
    this.kit.scene.remove(e.rig.root);
    disposeRig(e.rig);
    e.plate.tex.dispose(); (e.plate.sprite.material as THREE.SpriteMaterial).dispose();
    this.entries.delete(e.uid);
    if (e.graveOk) {
      const g = new THREE.Group();
      const stone = mat(0x9aa1a9, { rough: 0.8, metal: 0 }), base = mat(0x3a3f47, { rough: 0.9, metal: 0 });
      const v = new THREE.Mesh(G.box(0.1, 0.55, 0.1), stone); v.position.y = 0.28;
      const h = new THREE.Mesh(G.box(0.34, 0.09, 0.09), stone); h.position.y = 0.42;
      const b = new THREE.Mesh(G.box(0.5, 0.08, 0.7), base); b.position.y = 0.04;
      const glow = new THREE.Mesh(G.ring(0.3, 0.38, 20), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03;
      const pick = new THREE.Mesh(G.cyl(0.4, 0.4, 0.8, 8), pickMat);
      pick.position.y = 0.4; pick.visible = false; pick.userData.tile = e.tile;
      g.add(v, h, b, glow, pick);
      g.position.set(gx(e.tile.x), this.topY(e.tile.x, e.tile.z), gx(e.tile.z));
      g.userData.pick = pick;
      this.kit.scene.add(g); this.graves.set(e.uid, g);
    }
  }

  dispose() {
    this.cleanup.forEach(f => f());
    this.entries.forEach(e => {
      disposeRig(e.rig);
      e.plate.tex.dispose();
    });
    this.entries.clear();
    this.kit.dispose();
  }
}
