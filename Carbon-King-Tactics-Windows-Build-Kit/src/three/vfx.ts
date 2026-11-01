import * as THREE from 'three';
import { G } from './kit';

/**
 * Pooled VFX. Everything is allocated once in the constructor; effects only recycle pool slots.
 * Sparks / dust: InstancedMesh particle systems with an active-count fast path.
 * Tracers, beams, muzzle flashes, ground rings, crescent blade slashes, and shield flares: pooled meshes.
 */

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _a = new THREE.Vector3();

class Particles {
  readonly mesh: THREE.InstancedMesh;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private max: Float32Array; private size: Float32Array; private grav: Float32Array;
  private alive: Uint8Array;
  private liveCount = 0;
  private cursor = 0;
  constructor(geo: THREE.BufferGeometry, material: THREE.Material, private n: number, private puff: boolean) {
    this.mesh = new THREE.InstancedMesh(geo, material, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set(0xffffff));
    const mk = () => new Float32Array(n);
    this.px = mk(); this.py = mk(); this.pz = mk(); this.vx = mk(); this.vy = mk(); this.vz = mk();
    this.life = mk(); this.max = mk(); this.size = mk(); this.grav = mk();
    this.alive = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grav: number, color: number) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
    if (!this.alive[i]) this.liveCount++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.max[i] = life; this.size[i] = size; this.grav[i] = grav; this.alive[i] = 1;
    this.mesh.setColorAt(i, _c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt: number) {
    if (this.liveCount === 0) return;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        this.liveCount--;
        this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        continue;
      }
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      const prog = 1 - this.life[i] / this.max[i];
      const sc = this.puff ? this.size[i] * (0.5 + prog) * Math.pow(Math.sin(Math.min(1, prog) * Math.PI), 0.6) : this.size[i] * (1 - prog);
      this.mesh.setMatrixAt(i, _m.compose(_p.set(this.px[i], this.py[i], this.pz[i]), _q.identity(), _s.setScalar(Math.max(0.001, sc))));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Timed { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; grow: number }
interface SlashSlot { pivot: THREE.Group; disc: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; spin0: number; spin1: number }

export class Vfx {
  shake = 0;
  private sparks: Particles;
  private dusts: Particles;
  private tracers: Timed[] = [];
  private flashes: Timed[] = [];
  private rings: Timed[] = [];
  private shields: Timed[] = [];
  private slashes: SlashSlot[] = [];

  constructor(scene: THREE.Scene) {
    this.sparks = new Particles(G.ico(0.06, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 240, false);
    this.dusts = new Particles(G.sph(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xd8c39a, transparent: true, opacity: 0.55, depthWrite: false }), 60, true);
    scene.add(this.sparks.mesh, this.dusts.mesh);

    const timed = (geo: THREE.BufferGeometry, n: number, color: number, flat = false) => {
      const out: Timed[] = [];
      for (let i = 0; i < n; i++) {
        const mt = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mt);
        mesh.visible = false; mesh.frustumCulled = false;
        if (flat) mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        out.push({ mesh, mat: mt, life: 0, max: 1, grow: 1 });
      }
      return out;
    };
    this.tracers = timed(G.box(1, 1, 1), 12, 0xfff2b0);
    this.flashes = timed(G.ico(0.14, 0), 8, 0xffd36a);
    this.rings = timed(G.ring(0.2, 0.27, 28), 8, 0x2de2d0, true);
    this.shields = timed(G.ring(0.24, 0.42, 6), 6, 0x38bdf8, false);

    // pooled crescent slash arcs
    const arcGeo = G.arc(0.44, 0.86, 22, -1.25, 2.5);
    for (let i = 0; i < 8; i++) {
      const mt = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
      const disc = new THREE.Mesh(arcGeo, mt);
      disc.rotation.x = -Math.PI / 2;
      disc.frustumCulled = false;
      const pivot = new THREE.Group();
      pivot.visible = false;
      pivot.add(disc);
      scene.add(pivot);
      this.slashes.push({ pivot, disc, mat: mt, life: 0, max: 0.22, spin0: -1.1, spin1: 1.1 });
    }
  }

  sparksAt(x: number, y: number, z: number, n = 10, color = 0xffe08a, speed = 2.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.sparks.emit(x, y, z, Math.cos(a) * speed * u, 0.8 + Math.random() * speed * 0.7, Math.sin(a) * speed * u, 0.35 + Math.random() * 0.3, 0.8 + Math.random() * 0.8, 7, color);
    }
  }
  dust(x: number, y: number, z: number, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.dusts.emit(x + Math.cos(a) * 0.2, y + 0.06, z + Math.sin(a) * 0.2, Math.cos(a) * 0.6, 0.35 + Math.random() * 0.2, Math.sin(a) * 0.6, 0.55 + Math.random() * 0.2, 0.9 + Math.random() * 0.5, -0.3, 0xd8c39a);
    }
  }
  /** Ejects a hot brass shell casing sideways from a firearm breech. */
  shellEject(at: THREE.Vector3, yaw: number) {
    const sx = Math.cos(yaw) * (1.2 + Math.random() * 0.7);
    const sz = -Math.sin(yaw) * (1.2 + Math.random() * 0.7);
    this.sparks.emit(at.x, at.y, at.z, sx, 2.0 + Math.random() * 0.6, sz, 0.42, 0.72, 9.5, 0xfbbf24);
  }
  private take<T extends { life: number }>(pool: T[]): T {
    let best = pool[0];
    for (const t of pool) { if (t.life <= 0) return t; if (t.life < best.life) best = t; }
    return best;
  }
  /** Sweeping crescent blade-slash arc around an attacker toward `yaw`. `tilt` ~0.3 = cleave, ~1.48 = overhead slam. */
  slashArc(x: number, y: number, z: number, yaw: number, tilt = 0.3, color = 0xfff0a8, scale = 1.05) {
    const s = this.take(this.slashes);
    s.pivot.position.set(x, y, z);
    s.pivot.rotation.set(0, yaw, tilt);
    s.pivot.scale.setScalar(scale);
    s.mat.color.set(color);
    s.mat.opacity = 1;
    s.life = s.max = 0.22;
    s.spin0 = -1.15;
    s.spin1 = 0.95;
    s.disc.rotation.z = s.spin0;
    s.pivot.visible = true;
  }
  /** Piercing spear shock-streak + forward air-burst ring. */
  thrustWave(from: THREE.Vector3, to: THREE.Vector3, color = 0xe2f8ff) {
    this.line(from, to, 0xffffff, 0.045, 0.16);
    this.line(from, to, color, 0.11, 0.2);
    const sh = this.take(this.shields);
    sh.mesh.position.copy(_a.copy(from).lerp(to, 0.55));
    sh.mesh.lookAt(to);
    sh.mesh.scale.setScalar(0.35);
    sh.mat.color.set(color);
    sh.mat.opacity = 0.9;
    sh.life = sh.max = 0.22;
    sh.grow = 1.3;
    sh.mesh.visible = true;
  }
  /** Upright hexagonal barrier ripple when a shield or Aegis barrier absorbs/deflects an impact. */
  shieldFlare(x: number, y: number, z: number, fromX: number, fromZ: number, color = 0x38bdf8) {
    const yaw = Math.atan2(fromX - x, fromZ - z);
    const sh = this.take(this.shields);
    sh.mesh.position.set(x + Math.sin(yaw) * 0.42, y + 0.82, z + Math.cos(yaw) * 0.42);
    sh.mesh.rotation.set(0, yaw, 0);
    sh.mesh.scale.setScalar(0.55);
    sh.mat.color.set(color);
    sh.mat.opacity = 1;
    sh.life = sh.max = 0.34;
    sh.grow = 1.25;
    sh.mesh.visible = true;
    this.sparksAt(sh.mesh.position.x, sh.mesh.position.y, sh.mesh.position.z, 10, color, 2.4);
  }
  /** thin glowing line between two points (bullet tracer / energy beam) */
  line(from: THREE.Vector3, to: THREE.Vector3, color: number, thick = 0.035, life = 0.12) {
    const t = this.take(this.tracers);
    const len = from.distanceTo(to);
    t.mesh.position.copy(_a.copy(from).add(to).multiplyScalar(0.5));
    t.mesh.lookAt(to);
    t.mesh.scale.set(thick, thick, len);
    t.mat.color.set(color); t.mat.opacity = 1;
    t.life = t.max = life; t.grow = thick; t.mesh.visible = true;
  }
  beam(from: THREE.Vector3, to: THREE.Vector3, color = 0x4fe8ff) {
    this.flash(from, color);
    this.line(from, to, 0xffffff, 0.055, 0.28);
    this.line(from, to, color, 0.17, 0.34);
    this.sparksAt(to.x, to.y, to.z, 12, color, 2.4);
  }
  flash(at: THREE.Vector3, color = 0xffd36a) {
    const t = this.take(this.flashes);
    t.mesh.position.copy(at); t.mesh.scale.setScalar(1.25 + Math.random() * 0.6);
    t.mat.color.set(color); t.mat.opacity = 1; t.life = t.max = 0.1; t.mesh.visible = true;
  }
  ring(x: number, y: number, z: number, color = 0x2de2d0, size = 2.4) {
    const t = this.take(this.rings);
    t.mesh.position.set(x, y + 0.05, z); t.mesh.scale.setScalar(0.4);
    t.mat.color.set(color); t.mat.opacity = 0.95; t.life = t.max = 0.7; t.grow = size; t.mesh.visible = true;
  }
  explosion(x: number, y: number, z: number) {
    this.sparksAt(x, y + 0.3, z, 36, 0xffa54a, 5);
    this.sparksAt(x, y + 0.3, z, 14, 0xfff2b0, 3);
    this.dust(x, y, z, 9);
    this.ring(x, y, z, 0xff8a3a, 3.6);
    this.shake = Math.max(this.shake, 0.35);
  }

  update(dt: number) {
    this.sparks.update(dt); this.dusts.update(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.mesh.visible = false; continue; }
      t.mat.opacity = t.life / t.max;
    }
    for (const t of this.flashes) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.mesh.visible = false; continue; }
      t.mat.opacity = t.life / t.max; t.mesh.scale.multiplyScalar(0.94);
    }
    for (const t of this.rings) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.mesh.visible = false; continue; }
      const p = 1 - t.life / t.max;
      t.mesh.scale.setScalar(0.4 + p * t.grow); t.mat.opacity = (1 - p) * 0.95;
    }
    for (const sh of this.shields) {
      if (sh.life <= 0) continue;
      sh.life -= dt;
      if (sh.life <= 0) { sh.mesh.visible = false; continue; }
      const p = 1 - sh.life / sh.max;
      sh.mesh.scale.setScalar(0.45 + p * sh.grow);
      sh.mat.opacity = (1 - p);
    }
    for (const s of this.slashes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.pivot.visible = false; continue; }
      const p = 1 - s.life / s.max;
      s.disc.rotation.z = s.spin0 + (s.spin1 - s.spin0) * Math.pow(p, 0.65);
      s.mat.opacity = Math.sin(p * Math.PI);
    }
    this.shake = Math.max(0, this.shake - dt * 1.45);
  }
}
