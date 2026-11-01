import * as THREE from 'three';
import type { BattleMap } from '../game/terrain';
import { buildEnvironment, type Environment } from './environment';
import { buildBattleTerrain, type TerrainHandles } from './battleTerrain';
import { Vfx } from './vfx';
import { disposeSceneObjects } from './kit';

/**
 * Shared 3D stage: pools a warm WebGLRenderer across Title, Story, and Battle so transitions
 * never destroy/recreate WebGL contexts or recompile cached shaders.
 */

export interface StageKit {
  el: HTMLElement; scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  terrain: TerrainHandles; env: Environment; vfx: Vfx;
  setFrame(cb: (t: number, dt: number, now: number) => void): void;
  dispose(): void;
}

let pooledRenderer: THREE.WebGLRenderer | null = null;
let poolBusy = false;

function acquireRenderer(w: number, h: number): { renderer: THREE.WebGLRenderer; pooled: boolean } {
  if (!poolBusy) {
    if (!pooledRenderer) {
      pooledRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      pooledRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      pooledRenderer.toneMappingExposure = 1.05;
    }
    poolBusy = true;
    pooledRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    pooledRenderer.setSize(Math.max(1, w), Math.max(1, h));
    return { renderer: pooledRenderer, pooled: true };
  }
  const extra = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  extra.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  extra.setSize(Math.max(1, w), Math.max(1, h));
  extra.toneMapping = THREE.ACESFilmicToneMapping;
  extra.toneMappingExposure = 1.05;
  return { renderer: extra, pooled: false };
}

export function createStageKit(el: HTMLElement, bmap: BattleMap, nodeId: string): StageKit {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 0.1, 180);
  const { renderer, pooled } = acquireRenderer(el.clientWidth, el.clientHeight);
  el.appendChild(renderer.domElement);

  const env = buildEnvironment(scene, bmap.theme, nodeId);
  const terrain = buildBattleTerrain(scene, bmap, nodeId);
  const vfx = new Vfx(scene);

  let frame: ((t: number, dt: number, now: number) => void) | null = null;
  let raf = 0, last = performance.now(), t = 0, alive = true;
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    frame?.(t, dt, now);
    terrain.update(t); env.update(t); vfx.update(dt);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const ro = new ResizeObserver(() => {
    if (!alive || !el.clientWidth || !el.clientHeight) return;
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(el.clientWidth, el.clientHeight);
  });
  ro.observe(el);

  return {
    el, scene, camera, renderer, terrain, env, vfx,
    setFrame(cb) { frame = cb; },
    dispose() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      const cv = renderer.domElement;
      disposeSceneObjects(scene);
      scene.clear();
      renderer.renderLists.dispose();
      if (el.contains(cv)) el.removeChild(cv);
      if (pooled) {
        poolBusy = false;
      } else {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    },
  };
}
