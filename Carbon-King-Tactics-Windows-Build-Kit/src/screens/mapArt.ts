import { mulberry, clamp } from '../lib/rng';

/**
 * Painted Colorado: an elevation field (plains -> foothills -> Front Range / Sawatch / San Juans / Sangres -> western mesas)
 * shaded with NW light, tinted red-rock in the west, then inked with rivers, lakes and mountain glyphs.
 * Generated once on a canvas and used as the SVG map's base image.
 */

export const MAP_H = 104;
/** the painting extends past the state border (Utah, Kansas, New Mexico...) so the map panel never shows dead space */
export const MAP_X0 = -30, MAP_WW = 160;
type Pt = [number, number];

/** Hand-inked state outline (Colorado's legal border is a near-perfect rectangle; the wobble is cartographic style). */
function outline(): Pt[] {
  const r = mulberry(77), pts: Pt[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) { const t = i / n, j = i ? 0.9 : 0; pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * j, y0 + (y1 - y0) * t + (r() - 0.5) * j]); }
  };
  edge(2.5, 5.5, 97.5, 5.5, 18); edge(97.5, 5.5, 97.5, 99, 18); edge(97.5, 99, 2.5, 99, 18); edge(2.5, 99, 2.5, 5.5, 18);
  return pts;
}
export const STATE_PATH = 'M' + outline().map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L') + ' Z';

const RIDGES: { pts: Pt[]; h: number; w: number }[] = [
  { pts: [[67, 7], [66, 18], [65.5, 28], [66.5, 38], [66, 48], [65, 57], [63, 63]], h: 0.82, w: 3.8 },      // Front Range
  { pts: [[52, 8], [55, 16], [58, 24], [60, 30]], h: 0.86, w: 4 },                                         // Park / Gore
  { pts: [[58, 33], [55, 40], [54, 46], [52, 52]], h: 0.95, w: 3.6 },                                      // Sawatch / Mosquito
  { pts: [[46, 34], [45, 42], [47, 48]], h: 0.9, w: 3.5 },                                                 // Elk Range
  { pts: [[30, 55], [35, 60], [40, 64], [44, 68]], h: 0.96, w: 6 },                                        // San Juans
  { pts: [[61, 66], [60, 76], [63, 84], [68, 90]], h: 0.9, w: 3.4 },                                       // Sangre de Cristo
  { pts: [[64, 66], [67, 74]], h: 0.5, w: 3 },                                                             // Wet Mtns / Spanish Peaks
  { pts: [[36, 16], [40, 22], [45, 26]], h: 0.62, w: 4 },                                                  // Flat Tops
  { pts: [[28, 30], [24, 38], [22, 44]], h: 0.42, w: 5 },                                                  // Grand Mesa
  { pts: [[65, 55], [65.5, 57]], h: 0.98, w: 1.8 },                                                        // Pikes Peak
];

const LAT = (() => { const r = mulberry(4242), a = new Float32Array(64 * 64); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const sm = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
  const g = (i: number, j: number) => LAT[((j & 63) << 6) | (i & 63)];
  const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

function segDist(px: number, py: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

function elevation(x: number, y: number): number {
  let e = 0.04 + 0.2 * sm(clamp((78 - x) / 38, 0, 1));
  for (const r of RIDGES) {
    let d = 1e9;
    for (let i = 0; i < r.pts.length - 1; i++) d = Math.min(d, segDist(x, y, r.pts[i], r.pts[i + 1]));
    e = Math.max(e, r.h * Math.exp(-((d / r.w) ** 2)) * (0.8 + 0.4 * vnoise(x * 0.35, y * 0.35)));
  }
  e -= 0.12 * Math.max(0, 1 - Math.hypot(x - 53, (y - 70) * 0.8) / 8);   // San Luis Valley
  e -= 0.08 * Math.max(0, 1 - Math.hypot(x - 20, y - 22) / 14);          // Uinta basin
  return clamp(e + (vnoise(x * 0.12, y * 0.12) - 0.5) * 0.12, 0, 1);
}

const RAMP: number[][] = [
  [0.0, 201, 181, 112], [0.1, 186, 172, 100], [0.2, 142, 156, 88], [0.32, 96, 134, 84],
  [0.46, 62, 108, 78], [0.62, 98, 100, 86], [0.78, 134, 128, 116], [0.91, 232, 238, 244], [1.0, 252, 253, 255],
];
function ramp(e: number, out: number[]) {
  let i = 0;
  while (i < RAMP.length - 2 && e > RAMP[i + 1][0]) i++;
  const a = RAMP[i], b = RAMP[i + 1], t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * t; out[1] = a[2] + (b[2] - a[2]) * t; out[2] = a[3] + (b[3] - a[3]) * t;
}

let cached: string | null = null;

export function paintColoradoMap(): string {
  if (cached) return cached;
  const EW = 400, EH = 260, CW = 1600, CH = 1040;
  const el = new Float32Array(EW * EH), sh = new Float32Array(EW * EH), wash = new Float32Array(EW * EH);
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const x = MAP_X0 + (i / EW) * MAP_WW, y = (j / EH) * MAP_H;
    el[j * EW + i] = elevation(x, y); wash[j * EW + i] = fbm(x * 0.3, y * 0.3);
  }
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const dx = el[j * EW + Math.min(EW - 1, i + 1)] - el[j * EW + Math.max(0, i - 1)];
    const dy = el[Math.min(EH - 1, j + 1) * EW + i] - el[Math.max(0, j - 1) * EW + i];
    sh[j * EW + i] = clamp(1 + (-dx - dy) * 4, 0.72, 1.3);
  }
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(CW, CH), d = img.data, rgb = [0, 0, 0];
  const x0s = new Int32Array(CW), x1s = new Int32Array(CW), us = new Float32Array(CW), xMasks = new Float32Array(CW);
  for (let px = 0; px < CW; px++) {
    const gx = (px / CW) * (EW - 1), x0 = gx | 0;
    x0s[px] = x0; x1s[px] = x0 + 1 < EW ? x0 + 1 : EW - 1; us[px] = gx - x0;
    xMasks[px] = sm(clamp((54 - (MAP_X0 + px * 0.1)) / 14, 0, 1));
  }
  for (let py = 0; py < CH; py++) {
    const gy = (py / CH) * (EH - 1), y0 = gy | 0, y1 = y0 + 1 < EH ? y0 + 1 : EH - 1, v = gy - y0;
    const r0 = y0 * EW, r1 = y1 * EW, y = py * 0.1;
    const yMask = sm(clamp((y - 22) / 12, 0, 1)) * sm(clamp((88 - y) / 12, 0, 1));
    const pyHash = py * 19349663;
    let o = py * CW * 4;
    for (let px = 0; px < CW; px++, o += 4) {
      const x0 = x0s[px], x1 = x1s[px], u = us[px], uv = u * v;
      const ea = el[r0 + x0], eb = el[r0 + x1], ec = el[r1 + x0], ed = el[r1 + x1];
      const e = ea + (eb - ea) * u + (ec - ea) * v + (ea - eb - ec + ed) * uv;
      const sa = sh[r0 + x0], sb = sh[r0 + x1], sc = sh[r1 + x0], sd = sh[r1 + x1];
      const s = sa + (sb - sa) * u + (sc - sa) * v + (sa - sb - sc + sd) * uv;
      const w = wash[r0 + x0];
      ramp(e, rgb);
      const mask = xMasks[px] * yMask;
      if (mask > 0 && e < 0.36) {                            // western red-rock country
        const k = (1 - e / 0.36) * 0.55 * (0.6 + w * 0.8) * mask;
        rgb[0] += (186 - rgb[0]) * k; rgb[1] += (104 - rgb[1]) * k; rgb[2] += (66 - rgb[2]) * k;
      }
      const jitter = (((((px * 73856093) ^ pyHash) >>> 0) & 255) * 0.0039215686 - 0.5) * 9;
      const mul = s * (0.94 + w * 0.12);
      d[o] = rgb[0] * mul + jitter; d[o + 1] = rgb[1] * mul + jitter; d[o + 2] = rgb[2] * mul + jitter; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.scale(10, 10);
  ctx.translate(-MAP_X0, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const river = (pts: Pt[], w: number) => {
    for (const [lw, col] of [[w * 2.2, 'rgba(20,70,100,.35)'], [w, 'rgba(110,200,235,.95)']] as const) {
      ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.stroke();
    }
  };
  river([[60, 42], [66, 38], [71, 33], [75, 28], [80, 24], [87, 19], [97, 14]], 0.3);          // South Platte
  river([[56, 40], [56, 50], [60, 60], [68, 67], [76, 67], [86, 67], [97, 68]], 0.34);          // Arkansas
  river([[55, 23], [48, 28], [40, 33], [30, 35], [22, 38], [3, 42]], 0.36);                     // Colorado
  river([[44, 64], [50, 68], [54, 72], [56, 80], [56, 98]], 0.3);                               // Rio Grande
  river([[38, 17], [28, 16], [14, 20], [4, 22]], 0.26);                                         // Yampa
  river([[36, 66], [34, 74], [32, 88]], 0.22);                                                  // Animas
  for (const [x, y, rx, ry] of [[64.5, 67.5, 1.6, 0.7], [58, 29.5, 1.1, 0.8], [64, 12.5, 0.8, 1.2], [66, 86.5, 0.9, 0.5], [56, 71.5, 0.7, 0.5]]) {
    ctx.fillStyle = 'rgba(96,190,230,.95)'; ctx.strokeStyle = 'rgba(20,70,100,.6)'; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.4, 0, 7); ctx.fill(); ctx.stroke();
  }
  // mountain glyphs on high ground
  const r = mulberry(9);
  for (let i = 0; i < 900 && i >= 0; i++) {
    const x = MAP_X0 + r() * MAP_WW, y = r() * MAP_H, e = el[Math.min(EH - 1, Math.floor((y / MAP_H) * EH)) * EW + Math.min(EW - 1, Math.floor(((x - MAP_X0) / MAP_WW) * EW))];
    if (e < 0.6 || r() > 0.32) continue;
    const s = 0.55 + r() * 0.7;
    ctx.fillStyle = e > 0.74 ? 'rgba(250,252,255,.9)' : 'rgba(70,70,70,.18)'; ctx.strokeStyle = 'rgba(30,36,50,.5)'; ctx.lineWidth = 0.1;
    ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  cached = cv.toDataURL('image/jpeg', 0.9);
  return cached;
}
