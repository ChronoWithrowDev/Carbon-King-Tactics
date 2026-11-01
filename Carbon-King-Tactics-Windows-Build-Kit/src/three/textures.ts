import * as THREE from 'three';
import { mulberry, hashStr } from '../lib/rng';
import type { TexKind } from '../game/terrain';
import { share } from './kit';

/** Procedural canvas textures (grayscale detail that gets tinted by per-tile colors). */

const cache = new Map<string, THREE.Texture>();

function paint(kind: TexKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = mulberry(hashStr(kind));
  g.fillStyle = '#d6d6d6';
  g.fillRect(0, 0, 128, 128);
  const speck = (n: number, lo: number, hi: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const l = Math.floor(lo + r() * (hi - lo));
      g.fillStyle = `rgb(${l},${l},${l})`;
      g.fillRect(r() * 128, r() * 128, size * (0.5 + r()), size * (0.5 + r()));
    }
  };
  const strokes = (n: number, len: number, a: string, w = 1) => {
    g.strokeStyle = a; g.lineWidth = w;
    for (let i = 0; i < n; i++) {
      const x = r() * 128, y = r() * 128;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * len, y + (r() - 0.5) * len); g.stroke();
    }
  };
  switch (kind) {
    case 'grass': speck(420, 175, 255, 1.6); strokes(170, 5, 'rgba(140,140,140,.45)'); speck(40, 140, 170, 3); break;
    case 'dirt': speck(650, 160, 245, 2); speck(90, 120, 175, 4); break;
    case 'rock': speck(300, 150, 235, 3); strokes(14, 40, 'rgba(100,100,100,.55)', 1.4); speck(50, 120, 160, 5); break;
    case 'concrete':
      speck(900, 188, 236, 1);
      g.strokeStyle = 'rgba(140,140,140,.6)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
      g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.lineWidth = 1; g.stroke();
      break;
    case 'snow': speck(280, 236, 255, 2); speck(70, 205, 228, 4); break;
    case 'sand':
      speck(500, 190, 245, 1.5);
      g.strokeStyle = 'rgba(180,180,180,.35)'; g.lineWidth = 1.4;
      for (let y = 8; y < 128; y += 14) { g.beginPath(); for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x * 0.12 + y) * 3); g.stroke(); }
      break;
    case 'asphalt': speck(1300, 168, 228, 1); speck(60, 130, 160, 3); break;
  }
  return c;
}

export function tileTexture(kind: TexKind): THREE.Texture {
  let t = cache.get(kind);
  if (!t) {
    t = share(new THREE.CanvasTexture(paint(kind)));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    cache.set(kind, t);
  }
  return t;
}

/** Soft radial alpha used for blob shadows. */
export function blobTexture(): THREE.Texture {
  let t = cache.get('blob');
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(0,0,0,.85)');
    grad.addColorStop(0.55, 'rgba(0,0,0,.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    t = share(new THREE.CanvasTexture(c));
    cache.set('blob', t);
  }
  return t;
}
