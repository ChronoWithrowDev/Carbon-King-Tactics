import * as THREE from 'three';
import type { Theme } from '../game/terrain';
import { mulberry, hashStr } from '../lib/rng';
import { G, mergeParts, type Part } from './kit';

/** Gradient sky dome + sun glow, exp fog, 3-point lighting, horizon silhouettes, faint clouds, GPU dust motes. */

export interface Environment { update(t: number): void }

const SKY_VS = `varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SKY_FS = `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uFog;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uTop, smoothstep(0.18, 0.85, h));
  col = mix(col, uFog, smoothstep(0.0, -0.12, d.y));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSun * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.55 + pow(s, 5.0) * 0.12);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const MOTE_VS = `uniform float uTime;
uniform float uScale;
attribute float aId;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.25 + aId) * 0.9 + mod(uTime * 0.12, 14.0) - 7.0 * step(7.0, p.x + mod(uTime * 0.12, 14.0));
  p.y = mod(p.y + uTime * 0.07 * (1.0 + mod(aId, 3.0)), 4.2);
  p.z += cos(uTime * 0.21 + aId * 1.3) * 0.7;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uScale / max(1.0, -mv.z), 1.5, 6.0);
  gl_Position = projectionMatrix * mv;
}`;

const MOTE_FS = `uniform vec3 uColor;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c);
  if (r > 0.25) discard;
  gl_FragColor = vec4(uColor, (0.25 - r) * 2.0);
  #include <colorspace_fragment>
}`;

export function buildEnvironment(scene: THREE.Scene, theme: Theme, nodeId: string): Environment {
  const rnd = mulberry(hashStr('env' + nodeId));
  scene.background = new THREE.Color(theme.skyHorizon);
  scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

  // lighting: hemisphere + warm key + gold rim (from the sun side) + faint teal fill. No shadow maps.
  scene.add(new THREE.HemisphereLight(theme.skyMid, theme.ground, 1.0));
  const key = new THREE.DirectionalLight(0xffe2b0, 1.9); key.position.set(8, 14, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(theme.sun, 0.95); rim.position.set(-9, 5, -10); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x59d8d0, 0.35); fill.position.set(-7, 6, 6); scene.add(fill);

  const sky = new THREE.Mesh(G.sph(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(theme.skyTop) }, uMid: { value: new THREE.Color(theme.skyMid) },
      uHor: { value: new THREE.Color(theme.skyHorizon) }, uSun: { value: new THREE.Color(theme.sun) }, uFog: { value: new THREE.Color(theme.fog) },
      uSunDir: { value: new THREE.Vector3(-0.55, 0.15, -0.82) },
    },
    vertexShader: SKY_VS, fragmentShader: SKY_FS,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // ground: radial haze gradient (theme ground at the board -> fog color at the rim, matching the sky below the horizon)
  const gGeo = new THREE.CircleGeometry(60, 64);
  const gPos = gGeo.attributes.position, gCol = new Float32Array(gPos.count * 3);
  const c0 = new THREE.Color(theme.ground).multiplyScalar(0.9), c1 = new THREE.Color(theme.fog), tmp = new THREE.Color();
  for (let i = 0; i < gPos.count; i++) {
    const t = Math.min(1, Math.hypot(gPos.getX(i), gPos.getY(i)) / 60);
    tmp.copy(c0).lerp(c1, Math.min(1, t * 1.6));
    gCol[i * 3] = tmp.r; gCol[i * 3 + 1] = tmp.g; gCol[i * 3 + 2] = tmp.b;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  const ground = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.02;
  ground.matrixAutoUpdate = false; ground.updateMatrix();
  scene.add(ground);

  // horizon silhouettes: two merged rings (far = hazy, near = darker)
  const far: Part[] = [], near: Part[] = [];
  const fogC = new THREE.Color(theme.fog);
  const tintFar = fogC.clone().lerp(new THREE.Color(0x55627f), 0.5).getHex();
  const tintNear = fogC.clone().lerp(new THREE.Color(0x3f4b66), 0.72).getHex();
  const redC = theme.skyline === 'buttes';
  const ring = (parts: Part[], n: number, r0: number, r1: number, h0: number, h1: number, col: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.35;
      const r = r0 + rnd() * (r1 - r0), h = h0 + rnd() * (h1 - h0), w = 2.6 + rnd() * 3.4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (theme.skyline === 'city') {
        const bw = 1.6 + rnd() * 2, bh = h * (0.5 + rnd() * 0.7);
        parts.push({ g: G.box(1, 1, 1), c: col, p: [x, bh / 2 - 1, z], s: [bw, bh, bw] });
        for (let k = 0; k < 4; k++) parts.push({ g: G.box(0.25, 0.14, 0.04), c: k % 2 ? 0xffd37a : 0x9be9ff, p: [x + (rnd() - 0.5) * bw * 0.7, -1 + bh * (0.2 + rnd() * 0.7), z + bw / 2 + 0.03], glow: true, r: [0, -a + Math.PI / 2, 0] });
      } else if (redC) {
        parts.push({ g: G.cyl(0.62, 1, 1, 6), c: col, p: [x, h * 0.45 - 1, z], s: [w, h * 0.9, w * 0.8], r: [0, rnd() * 3, 0] });
      } else {
        parts.push({ g: G.cone(1, 1, 6), c: col, p: [x, h / 2 - 1, z], s: [w, h, w * 0.85], r: [0, rnd() * 3, 0] });
        if (theme.snowCaps || rnd() > 0.7) parts.push({ g: G.cone(1, 1, 6), c: 0xeaf0f7, p: [x, h - 1 - h * 0.17, z], s: [w * 0.4, h * 0.36, w * 0.34], r: [0, rnd() * 3, 0] });
      }
    }
  };
  const farCol = redC ? new THREE.Color(0x9a5a48).lerp(fogC, 0.45).getHex() : tintFar;
  const nearCol = redC ? new THREE.Color(0x7e4636).lerp(fogC, 0.25).getHex() : tintNear;
  ring(far, 18, 48, 62, 8, 15, farCol);
  ring(near, 12, 27, 34, 4, 8, nearCol);
  for (const parts of [far, near]) {
    const body = mergeParts(parts, false), glow = mergeParts(parts, true);
    if (body) { const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })); m.matrixAutoUpdate = false; scene.add(m); }
    if (glow) { const m = new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true })); m.matrixAutoUpdate = false; scene.add(m); }
  }

  // three tiny, very faint clouds
  const clouds: THREE.Mesh[] = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, fog: false });
  for (let i = 0; i < 3; i++) {
    const parts: Part[] = [];
    for (let j = 0; j < 3; j++) parts.push({ g: G.sph(1, 8, 6), c: 0xffffff, p: [j * 0.8 - 0.8, rnd() * 0.15, rnd() * 0.4], s: [0.45 + rnd() * 0.3, 0.2, 0.35] });
    const geo = mergeParts(parts, false);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, cloudMat);
    m.position.set(-20 + rnd() * 40, 12 + rnd() * 3, -16 + rnd() * 14);
    m.userData.bx = m.position.x;
    scene.add(m); clouds.push(m);
  }

  // drifting prairie dust motes — animated entirely on GPU via uTime uniform
  const N = 70;
  const pos = new Float32Array(N * 3), ids = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rnd() * 14 - 7; pos[i * 3 + 1] = rnd() * 4; pos[i * 3 + 2] = rnd() * 14 - 7;
    ids[i] = i;
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mg.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
  const moteUniforms = {
    uTime: { value: 0 },
    uScale: { value: 38 * Math.min(window.devicePixelRatio, 1.5) },
    uColor: { value: new THREE.Color(theme.sun) },
  };
  const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    uniforms: moteUniforms, vertexShader: MOTE_VS, fragmentShader: MOTE_FS,
    transparent: true, depthWrite: false, fog: false,
  }));
  motes.frustumCulled = false;
  motes.matrixAutoUpdate = false;
  scene.add(motes);

  return {
    update(t: number) {
      for (const c of clouds) c.position.x = ((c.userData.bx as number) + t * 0.22 + 30) % 60 - 30;
      moteUniforms.uTime.value = t;
    },
  };
}
