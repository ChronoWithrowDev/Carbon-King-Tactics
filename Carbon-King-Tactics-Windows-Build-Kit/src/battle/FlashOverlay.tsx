import { useEffect, useRef } from 'react';
import { sound } from '../lib/sound';

/**
 * Flash inference visualization (2D canvas over the battle):
 * 1) glyph tokens stream into a chip  2) current surges along the chip's circuit traces  3) caller resolves the ability.
 * All buffers are allocated once; the draw loop only mutates them.
 */

const GLYPHS = ['⟨tok⟩', 'Σ', 'λ', '∇', '0xA7', '1011', '◈', 'Q·K', '▓▒░', 'softmax', '⊕', '∂', 'ƒ', '01'];
type Pt = [number, number];

export default function FlashOverlay({ abilityName, user, onDone }: { abilityName: string; user: string; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = ref.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = (canvas.width = wrap.clientWidth), H = (canvas.height = wrap.clientHeight);
    const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.2, half = s / 2;
    let raf = 0, finished = false;
    const start = performance.now();
    sound.playFlashCycle();

    // circuit traces: manhattan polylines fanning out from the chip pins
    const traces: { pts: Pt[]; len: number[]; total: number; delay: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const side = i % 4, k = ((i / 4) | 0) / 5 - 0.4 + 0.1;
      const dir: Pt = side === 0 ? [0, -1] : side === 1 ? [1, 0] : side === 2 ? [0, 1] : [-1, 0];
      const perp: Pt = [-dir[1], dir[0]];
      let p: Pt = [cx + dir[0] * half + perp[0] * k * s, cy + dir[1] * half + perp[1] * k * s];
      const pts: Pt[] = [[p[0], p[1]]];
      let sgn = i % 2 ? 1 : -1;
      for (let seg = 0; seg < 3; seg++) {
        const L = (0.15 + ((i * 37 + seg * 17) % 10) / 40) * Math.min(W, H);
        p = [p[0] + (seg % 2 === 0 ? dir[0] : perp[0] * sgn) * L, p[1] + (seg % 2 === 0 ? dir[1] : perp[1] * sgn) * L];
        pts.push([p[0], p[1]]);
        if (seg === 1) sgn = -sgn;
      }
      const len = [0];
      for (let j = 1; j < pts.length; j++) len.push(len[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
      traces.push({ pts, len, total: len[len.length - 1], delay: (i % 7) * 0.05 });
    }
    const portion = (t: (typeof traces)[number], a: number, b: number) => {
      ctx.beginPath();
      let started = false;
      for (let j = 1; j < t.pts.length; j++) {
        const l0 = t.len[j - 1], l1 = t.len[j];
        if (b < l0 || a > l1) continue;
        const u0 = Math.max(0, (a - l0) / (l1 - l0)), u1 = Math.min(1, (b - l0) / (l1 - l0));
        const [x0, y0] = t.pts[j - 1], [x1, y1] = t.pts[j];
        if (!started) { ctx.moveTo(x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0); started = true; }
        ctx.lineTo(x0 + (x1 - x0) * u1, y0 + (y1 - y0) * u1);
      }
      ctx.stroke();
    };

    const tokens = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: 160 + Math.random() * 260, g: GLYPHS[(Math.random() * GLYPHS.length) | 0], hue: 160 + Math.random() * 50 }));
    let absorbed = 0;
    ctx.textAlign = 'center';

    const draw = (now: number) => {
      const el = (now - start) / 1000;
      ctx.fillStyle = 'rgba(2,6,16,0.84)'; ctx.fillRect(0, 0, W, H);
      const charge = Math.min(1, el / 1.0);
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, s * 2.6);
      g.addColorStop(0, `rgba(34,211,238,${0.18 + charge * 0.3})`); g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - s * 2.6, cy - s * 2.6, s * 5.2, s * 5.2);

      // dim traces, lit as current passes
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const t of traces) {
        ctx.strokeStyle = `rgba(94,234,212,${0.18 + charge * 0.22})`; portion(t, 0, t.total);
        const head = (el - 1.0 - t.delay) * Math.max(W, H) * 0.7;
        if (head > 0) {
          ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3.2; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 12;
          portion(t, Math.max(0, head - 150), Math.min(t.total, head));
          ctx.shadowBlur = 0; ctx.lineWidth = 2;
          if (head < t.total) { const j = t.len.findIndex(l => l >= head); const [x0, y0] = t.pts[Math.max(0, j - 1)], [x1, y1] = t.pts[Math.max(1, j)]; const u = (head - t.len[Math.max(0, j - 1)]) / Math.max(1, t.len[Math.max(1, j)] - t.len[Math.max(0, j - 1)]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 3.2, 0, 7); ctx.fill(); }
        }
      }

      // chip
      ctx.fillStyle = '#08111f'; ctx.strokeStyle = el > 1 ? `rgba(250,204,21,${0.6 + Math.sin(el * 30) * 0.3})` : '#22d3ee'; ctx.lineWidth = 3;
      ctx.shadowColor = el > 1 ? '#facc15' : '#22d3ee'; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.roundRect(cx - half, cy - half, s, s, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#22d3ee';
      for (let i = 0; i < 9; i++) { const o = -half + (i + 0.5) * (s / 9); ctx.fillRect(cx + o - 2, cy - half - 10, 4, 10); ctx.fillRect(cx + o - 2, cy + half, 4, 10); ctx.fillRect(cx - half - 10, cy + o - 2, 10, 4); ctx.fillRect(cx + half, cy + o - 2, 10, 4); }
      ctx.strokeStyle = 'rgba(34,211,238,.25)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - half + (i * s) / 6, cy - half + 6); ctx.lineTo(cx - half + (i * s) / 6, cy + half - 6); ctx.moveTo(cx - half + 6, cy - half + (i * s) / 6); ctx.lineTo(cx + half - 6, cy - half + (i * s) / 6); ctx.stroke(); }
      ctx.fillStyle = '#a5f3fc'; ctx.font = `bold ${Math.max(12, s * 0.12)}px monospace`;
      ctx.fillText('FLASH', cx, cy - 4); ctx.fillText('INFERENCE', cx, cy + s * 0.13);
      ctx.fillStyle = `rgba(250,204,21,${Math.min(0.9, absorbed / 80)})`; ctx.fillRect(cx - half + 8, cy + half - 14, (s - 16) * Math.min(1, absorbed / 80), 5);

      // glyph tokens stream into the chip
      ctx.font = 'bold 14px monospace';
      for (const t of tokens) {
        const dt = 1 / 60;
        t.y += t.v * dt * (1 + el * 0.8);
        const dx = cx - t.x, dy = cy - t.y, d = Math.hypot(dx, dy);
        if (el > 0.35 && d < 420) { t.x += dx * 0.05; t.y += dy * 0.05; }
        if (t.y > H + 20 || d < half * 0.7) { if (d < half * 0.7) absorbed++; t.y = -20; t.x = Math.random() * W; }
        ctx.fillStyle = `hsla(${t.hue},90%,68%,${Math.max(0.2, 1 - d / 1000)})`;
        ctx.fillText(t.g, t.x, t.y);
      }

      ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 20px system-ui'; ctx.fillText(`FLASH INFERENCE — ${abilityName}`, cx, 54);
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui';
      ctx.fillText(`${user}: tokens entering circuitry · current ${(3.2 + Math.sin(el * 9) * 0.4).toFixed(2)} THz`, cx, 76);
      const pr = Math.min(1, el / 2.2);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(cx - 180, H - 56, 360, 8);
      ctx.fillStyle = '#facc15'; ctx.fillRect(cx - 180, H - 56, 360 * pr, 8);

      if (el < 2.3) raf = requestAnimationFrame(draw);
      else if (!finished) { finished = true; doneRef.current(); }
    };
    raf = requestAnimationFrame(draw);
    return () => { finished = true; cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 z-[90]">
      <canvas ref={ref} className="h-full w-full" />
    </div>
  );
}
