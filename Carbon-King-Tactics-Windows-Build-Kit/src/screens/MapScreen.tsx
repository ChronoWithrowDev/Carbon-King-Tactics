import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WORLD_NODES, WORLD_NODE_COUNT, ROAD_EDGES, nodeById, neighborsOf, shortestPath, type WorldNode } from '../game/world';
import { useGame, baseStats, reachableNodes, questTarget } from '../game/store';
import { jobById } from '../game/jobs';
import { MAIN_QUEST, STORY_BEATS } from '../game/story';
import { hashStr, clamp } from '../lib/rng';
import GIcon from '../ui/GameIcon';
import { HudBar } from '../ui/Glass';
import { paintColoradoMap, STATE_PATH, MAP_H, MAP_X0, MAP_WW } from './mapArt';

const KIND_COLOR = { city: '#22d3ee', town: '#a5b4c8', landmark: '#4ade80', base: '#f87171' } as const;
const GLYPH: Record<string, string> = {
  city: 'M-1.3 .9 V-.6 H-.5 V-1.4 H.5 V-.2 H1.3 V.9 Z',
  town: 'M-1.1 .8 V-.2 L0 -1.2 L1.1 -.2 V.8 Z',
  landmark: 'M-1.4 .85 L-.35 -1.1 L.15 -.25 L.6 -.85 L1.4 .85 Z',
  base: 'M0 -1.3 L1.2 -.45 L.75 .95 L-.75 .95 L-1.2 -.45 Z',
};
const RADIUS = { city: 1.9, base: 2.0, landmark: 1.7, town: 1.45 } as const;
const MAIN_QUEST_SET = new Set(MAIN_QUEST);
const NODE_BY_ID = new Map(WORLD_NODES.map(n => [n.id, n]));
const nodeAt = (id: string) => NODE_BY_ID.get(id)!;

/** keep the camera inside the world; below 1x zoom is not allowed */
function fitCam(cx: number, cy: number, z: number, aspect: number) {
  z = clamp(z, 1, 6);
  const vh = MAP_H / z, vw = vh * aspect, lo = [-28, -2], hi = [128, 106];
  return {
    cx: vw >= hi[0] - lo[0] ? (lo[0] + hi[0]) / 2 : clamp(cx, lo[0] + vw / 2, hi[0] - vw / 2),
    cy: vh >= hi[1] - lo[1] ? (lo[1] + hi[1]) / 2 : clamp(cy, lo[1] + vh / 2, hi[1] - vh / 2),
    z,
  };
}

function curve(a: WorldNode, b: WorldNode) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const off = ((hashStr(a.id + b.id) % 100) / 100 - 0.5) * len * 0.14;
  return `M${a.x} ${a.y} Q${(a.x + b.x) / 2 - (dy / len) * off} ${(a.y + b.y) / 2 + (dx / len) * off} ${b.x} ${b.y}`;
}

const ROAD_PATHS = ROAD_EDGES.map(e => ({
  d: curve(nodeAt(e.a), nodeAt(e.b)),
  hwy: e.highway.startsWith('I-'),
}));

const RoadLayer = memo(function RoadLayer({ k }: { k: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      {ROAD_PATHS.map((r, i) => (
        <g key={i}>
          <path d={r.d} stroke="#0a1220" strokeOpacity="0.75" strokeWidth={(r.hwy ? 0.7 : 0.5) * k} />
          <path d={r.d} stroke={r.hwy ? '#f6b844' : '#d8cfae'} strokeOpacity={r.hwy ? 0.95 : 0.7} strokeWidth={(r.hwy ? 0.36 : 0.22) * k} />
        </g>
      ))}
    </g>
  );
});

interface NodeLayerProps {
  k: number;
  zoomDetail: boolean;
  visitedSet: Set<string>;
  reachableSet: Set<string>;
  currentNode: string;
  quest: string | null;
  sel: string;
  onSelect: (id: string) => void;
}

const NodeLayer = memo(function NodeLayer({ k, zoomDetail, visitedSet, reachableSet, currentNode, quest, sel, onSelect }: NodeLayerProps) {
  return (
    <>
      {WORLD_NODES.map(n => {
        const visited = visitedSet.has(n.id), isCur = currentNode === n.id, isQuest = quest === n.id;
        const canGo = reachableSet.has(n.id), dim = !canGo && !visited, storyNode = MAIN_QUEST_SET.has(n.id);
        const rr = RADIUS[n.kind] * k, color = KIND_COLOR[n.kind];
        const showLabel = visited || n.kind === 'city' || isQuest || sel === n.id || zoomDetail;
        return (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`} onClick={() => onSelect(n.id)} style={{ cursor: 'pointer' }} opacity={dim ? 0.42 : 1}>
            <circle r={3.2 * k} fill="transparent" />
            {isQuest && <circle r={3.6 * k} fill="none" stroke="#facc15" strokeWidth={0.5 * k} strokeDasharray={`${1 * k} ${0.7 * k}`}>
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            </circle>}
            {sel === n.id && <circle r={rr + 0.9 * k} fill="none" stroke="#fff" strokeWidth={0.35 * k} />}
            <circle r={rr} fill="#08111f" stroke={visited || isCur ? color : canGo ? '#e2e8f0' : '#64748b'} strokeWidth={0.34 * k} />
            <path d={GLYPH[n.kind]} transform={`scale(${(RADIUS[n.kind] / 1.9) * 0.95 * k})`} fill={visited || isCur ? color : canGo ? '#cbd5e1' : '#64748b'} />
            {visited && !isCur && <path d="M0 0 V-2.6 L1.8 -2 L0 -1.4" transform={`translate(${rr * 0.7} ${-rr * 0.6}) scale(${k})`} fill="#facc15" stroke="#3a2a00" strokeWidth="0.15" />}
            {dim && storyNode && <rect x={-0.5 * k} y={-0.5 * k} width={1 * k} height={1 * k} transform="rotate(45)" fill="#e3b94a" opacity="0.8" />}
            {showLabel && (
              <text y={-rr - 0.8 * k} textAnchor="middle" fontSize={(n.kind === 'city' || n.kind === 'base' ? 2.1 : 1.7) * k}
                fill={isQuest ? '#facc15' : '#f1f5f9'} fontWeight={isQuest || sel === n.id ? 800 : 600}
                stroke="#050a14" strokeWidth={0.55 * k} paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                {isQuest ? '★ ' : ''}{zoomDetail ? n.name : n.name.split(/ [—/] /)[0]}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
});

export default function MapScreen() {
  const g = useGame();
  const [sel, setSel] = useState<string>(g.currentNode);
  const [cam, setCam] = useState({ cx: 50, cy: 53, z: 1 });
  const [aspect, setAspect] = useState(1.45);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef(cam); camRef.current = cam;
  const aspectRef = useRef(aspect); aspectRef.current = aspect;
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);

  const art = useMemo(() => paintColoradoMap(), []);
  const visitedSet = useMemo(() => new Set(g.visited), [g.visited]);
  const reachable = useMemo(() => reachableNodes(g.visited, g.currentNode), [g.visited, g.currentNode]);
  const reachableSet = useMemo(() => new Set(reachable), [reachable]);
  const quest = questTarget(g.storyIndex);
  const nextBeat = quest
    ? STORY_BEATS[quest === 'walsenburg' && g.storyIndex > 0 ? 'walsenburg-return' : quest]
    : undefined;
  const route = useMemo(() => (quest ? shortestPath(g.currentNode, quest) : []), [g.currentNode, quest]);
  const selNode = nodeById(sel);
  const avgLvl = g.party.reduce((a, p) => a + p.level, 0) / Math.max(1, g.party.length);

  useEffect(() => {
    const el = wrapRef.current!;
    const upd = () => { if (el.clientHeight > 0) { const a = el.clientWidth / el.clientHeight; setAspect(a); setCam(c => fitCam(c.cx, c.cy, c.z, a)); } };
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = (factor: number, fx = 0.5, fy = 0.5) => {
    const c = camRef.current, a = aspectRef.current;
    const vh = MAP_H / c.z, vw = vh * a, wx = c.cx - vw / 2 + fx * vw, wy = c.cy - vh / 2 + fy * vh;
    const z = clamp(c.z * factor, 1, 6), nvh = MAP_H / z, nvw = nvh * a;
    setCam(fitCam(wx + nvw / 2 - fx * nvw, wy + nvh / 2 - fy * nvh, z, a));
  };
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 0.88 : 1.14, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const vh = MAP_H / cam.z, vw = vh * aspect, k = 1 / cam.z;
  const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, cx: cam.cx, cy: cam.cy, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const r = svgRef.current!.getBoundingClientRect();
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 5) d.moved = true;
    setCam(fitCam(d.cx - ((e.clientX - d.sx) / r.width) * vw, d.cy - ((e.clientY - d.sy) / r.height) * vh, cam.z, aspect));
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const click = useCallback((id: string) => { if (!drag.current?.moved) setSel(id); }, []);
  const goQuest = () => { if (!quest) return; const n = nodeAt(quest); setCam(fitCam(n.x, n.y, 2.6, aspect)); setSel(quest); };

  return (
    <div className="flex h-full flex-col bg-[#060b16] text-slate-100">
      <HudBar
        title="Carbon King Tactics" sub="Colorado Lattice · 2041"
        right={<>
          <span className="chip bg-amber-400/15 text-amber-300"><GIcon name="coins" size={12} />{g.gold}G</span>
          <span className="chip bg-cyan-400/15 text-cyan-300">{g.visited.length}/{WORLD_NODE_COUNT} nodes</span>
          <span className="chip bg-violet-400/15 text-violet-300"><GIcon name="swords" size={12} />{g.battlesWon}</span>
          {g.hasArtillery && <span className="chip bg-red-400/15 text-red-300"><GIcon name="bomb" size={12} />ARTY</span>}
          {g.hasAirstrike && <span className="chip bg-orange-400/15 text-orange-300"><GIcon name="plane" size={12} />AIR</span>}
          <button className="btn" onClick={() => g.setScreen('party')}><GIcon name="users" size={13} />PARTY</button>
          <button className="btn" onClick={() => g.setScreen('shop')}><GIcon name="shop" size={13} />SHOP</button>
          <button className="btn" onClick={() => g.setScreen('tavern')}><GIcon name="beer" size={13} />HIRE</button>
          <button className="btn" onClick={g.healParty}><GIcon name="heart" size={13} />HEAL 50G</button>
          <button className="btn" onClick={() => g.openSaves('map')} title="Save or load campaign"><GIcon name="save" size={13} />SAVE</button>
        </>}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_292px] gap-2 p-2">
        {/* ---------------- painted map ---------------- */}
        <div ref={wrapRef} className="glass relative min-h-0 overflow-hidden !rounded-xl bg-[#04080f]">
          <svg ref={svgRef} viewBox={`${cam.cx - vw / 2} ${cam.cy - vh / 2} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet"
            className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={0.5} /></filter>
              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#1b3350" strokeWidth="0.08" /></pattern>
            </defs>
            <rect x="-80" y="-80" width="260" height="270" fill="#050b16" />
            <rect x="-80" y="-80" width="260" height="270" fill="url(#grid)" />
            <image href={art} x={MAP_X0} y="0" width={MAP_WW} height={MAP_H} preserveAspectRatio="none" />
            <path fillRule="evenodd" d={`M-80 -80 H180 V190 H-80 Z ${STATE_PATH}`} fill="rgba(4,8,16,.66)" />
            <path d={STATE_PATH} fill="none" stroke="#0a1220" strokeWidth={1.3 * k + 0.4} strokeLinejoin="round" />
            <path d={STATE_PATH} fill="none" stroke="#e3b94a" strokeWidth={0.5 * k + 0.12} strokeLinejoin="round" />
            {[['UTAH', -3.6, 52, -90], ['WYOMING', 50, 2.6, 0], ['NEBRASKA', 90, 2.6, 0], ['KANSAS', 101.2, 52, 90], ['OKLAHOMA', 86, 102.6, 0], ['NEW MEXICO', 38, 102.6, 0]].map(([t, x, y, r]) => (
              <text key={t as string} x={x as number} y={y as number} textAnchor="middle" fontSize={2.2} letterSpacing="0.5" fill="#6f87a5" opacity="0.7" transform={`rotate(${r} ${x} ${y})`} fontWeight="bold">{t}</text>
            ))}

            <RoadLayer k={k} />

            {/* objective route: glowing, flowing */}
            {route.slice(0, -1).map((id, i) => {
              const d = curve(nodeAt(id), nodeAt(route[i + 1]));
              return (
                <g key={'r' + i} fill="none" strokeLinecap="round">
                  <path d={d} stroke="#facc15" strokeOpacity="0.55" strokeWidth={1.6 * k} filter="url(#glow)" />
                  <path d={d} stroke="#fff3b0" strokeWidth={0.5 * k} strokeDasharray={`${1.1 * k} ${0.9 * k}`}>
                    <animate attributeName="stroke-dashoffset" from="0" to={-2 * k} dur="0.9s" repeatCount="indefinite" />
                  </path>
                </g>
              );
            })}

            <NodeLayer
              k={k}
              zoomDetail={cam.z >= 2.4}
              visitedSet={visitedSet}
              reachableSet={reachableSet}
              currentNode={g.currentNode}
              quest={quest}
              sel={sel}
              onSelect={click}
            />

            {/* party token */}
            {(() => {
              const n = nodeAt(g.currentNode);
              return (
                <g transform={`translate(${n.x} ${n.y - RADIUS[n.kind] * k - 0.4 * k}) scale(${k})`} style={{ pointerEvents: 'none' }}>
                  <g>
                    <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.8;0 0" dur="1.4s" repeatCount="indefinite" />
                    <path d="M0 0 L-1.7 -3.4 A2 2 0 1 1 1.7 -3.4 Z" fill="#facc15" stroke="#3a2a00" strokeWidth="0.2" />
                    <circle cx="0" cy="-4.1" r="0.9" fill="#0b1626" />
                    <circle cx="0" cy="-4.1" r="0.4" fill="#2de2d0" />
                  </g>
                </g>
              );
            })()}

            {/* slow drifting cloud layer with light parallax */}
            <g opacity="0.1" transform={`translate(${(50 - cam.cx) * 0.25} 0)`} style={{ pointerEvents: 'none' }}>
              {[[10, 20, 9], [40, 50, 12], [75, 30, 8], [20, 82, 10], [85, 76, 9]].map(([x, y, r], i) => (
                <g key={i}>
                  <animateTransform attributeName="transform" type="translate" from="-40 0" to="140 0" dur={`${150 + i * 25}s`} repeatCount="indefinite" />
                  <ellipse cx={x} cy={y} rx={r} ry={r * 0.32} fill="#fff" /><ellipse cx={x + r * 0.5} cy={y - 1.2} rx={r * 0.6} ry={r * 0.24} fill="#fff" />
                </g>
              ))}
            </g>
          </svg>

          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button className="btn !h-8 !w-8 !p-0" onClick={() => zoomAt(1.3)} aria-label="Zoom in"><GIcon name="plus" size={14} /></button>
            <button className="btn !h-8 !w-8 !p-0" onClick={() => zoomAt(0.77)} aria-label="Zoom out"><GIcon name="minus" size={14} /></button>
            <button className="btn !h-8 !w-8 !p-0" onClick={() => setCam(fitCam(50, 53, 1, aspect))} aria-label="Reset view"><GIcon name="rotate" size={13} /></button>
            {quest && <button className="btn btn-gold !h-8 !w-8 !p-0" onClick={goQuest} aria-label="Center on objective"><GIcon name="star" size={14} /></button>}
          </div>
          <div className="hud-label pointer-events-none absolute bottom-1.5 left-2 rounded bg-black/50 px-2 py-0.5 !text-[9px]">drag pan · scroll zoom ({cam.z.toFixed(1)}x) · ★ objective · pin = party</div>
        </div>

        {/* ---------------- side panel ---------------- */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="glass px-3 py-2" style={{ borderColor: 'rgba(227,185,74,.4)' }}>
            <div className="hud-label !text-amber-300"><GIcon name="star" size={10} className="mr-1 inline" />Main quest {Math.min(g.storyIndex + 1, MAIN_QUEST.length)}/{MAIN_QUEST.length}</div>
            {quest ? (
              <>
                <div className="hud-objective mt-0.5 text-[14px] leading-tight">{nodeById(quest).name}</div>
                <div className="hud-body !text-[11px]">{nextBeat ? `${nextBeat.chapter} — ${nextBeat.title}. ` : ''}Follow the gold route; first visits always open a story and tactical battle.</div>
              </>
            ) : <div className="hud-body mt-1 !text-emerald-300">Campaign complete — free roam (35% ambush).</div>}
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-300" style={{ width: `${Math.min(100, (g.visited.length / WORLD_NODE_COUNT) * 100)}%` }} /></div>
          </div>

          <div className="glass px-3 py-2">
            <div className="flex items-center gap-1.5">
              <GIcon name={selNode.kind === 'base' ? 'bomb' : selNode.kind === 'landmark' ? 'mountain' : selNode.kind === 'city' ? 'building' : 'flag'} size={15} style={{ color: KIND_COLOR[selNode.kind] }} />
              <div className="text-[14px] font-black leading-none">{selNode.name}</div>
              <span className="chip ml-auto bg-white/10 !text-[8px] uppercase">{selNode.kind}{selNode.isBase ? ' · base' : ''}</span>
            </div>
            <div className="hud-label mt-1 !tracking-[0.12em]">{selNode.region} · Lv {selNode.level} (you {avgLvl.toFixed(1)}) · {visitedSet.has(sel) ? 'cleared' : 'NEW: story + battle'}</div>
            <p className="hud-body mt-1 line-clamp-2 !text-[11px]">{selNode.blurb}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {neighborsOf(sel).slice(0, 6).map(n => <button key={n.id} onClick={() => setSel(n.id)} className="btn !min-h-[22px] !px-1.5 !text-[9px]">{nodeById(n.id).name}</button>)}
            </div>
            <button disabled={!reachableSet.has(sel)} onClick={() => g.travelTo(sel)} className="btn btn-primary mt-2 w-full !min-h-[38px] !text-[12px]">
              {sel === g.currentNode ? `ENTER — ${selNode.name.toUpperCase()}` : reachableSet.has(sel) ? `TRAVEL ▸ ${selNode.name.toUpperCase()}` : <><GIcon name="lock" size={13} />NO ROAD — LOCKED</>}
            </button>
          </div>

          <div className="glass min-h-0 flex-1 px-2.5 py-2">
            <div className="hud-label">Party ({g.party.length}/6)</div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {g.party.map(p => {
                const s = baseStats(p);
                return (
                  <div key={p.id} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-1.5 py-1">
                    <GIcon name={p.icon} size={17} style={{ color: p.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-bold leading-none">{p.name}</div>
                      <div className="font-mono text-[8px] text-slate-400">Lv{p.level} {jobById(p.jobId).name}</div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded bg-black/60"><div className="h-full bg-emerald-400" style={{ width: `${(p.hp / s.maxHp) * 100}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass px-2.5 py-1.5">
            <div className="flex h-[48px] flex-col justify-end overflow-hidden font-mono text-[9px] leading-tight text-slate-400">
              {g.log.slice(-4).map((l, i) => <div key={i} className="truncate">› {l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
