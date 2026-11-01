import GIcon from '../ui/GameIcon';
import { effDef } from './combat';
import type { JobAbility } from '../game/jobs';
import type { BU, Floater, Panel } from './types';

/** Presentational battle HUD pieces. Layout only; rules live in useBattle / combat. */

const hpColor = (f: number) => (f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171');

export function TurnOrder({ order, units, turnPos }: { order: string[]; units: BU[]; turnPos: number }) {
  const seq: BU[] = [];
  for (let i = 0; i < order.length && seq.length < 9; i++) {
    const u = units.find(x => x.uid === order[(turnPos + i) % order.length]);
    if (u?.alive) seq.push(u);
  }
  return (
    <div className="glass pointer-events-none absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-end gap-1.5 px-2 py-1.5">
      {seq.map((u, i) => {
        const f = Math.max(0, u.hp / u.maxHp), show = u.team === 'player' || u.scanned;
        const border = i === 0 ? '#ffd24a' : u.team === 'player' ? '#2de2d0' : '#ff4d5e';
        return (
          <div key={u.uid + i} className="flex flex-col items-center" style={{ transform: i === 0 ? 'translateY(-2px) scale(1.12)' : undefined }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2" style={{ borderColor: border, background: `linear-gradient(160deg, ${u.team === 'player' ? '#0f3b44' : '#3b1420'}, #080d18)`, boxShadow: i === 0 ? '0 0 12px #ffd24a88' : undefined }}>
              <GIcon name={u.icon} size={18} style={{ color: u.color }} />
            </div>
            <div className="mt-0.5 h-[3px] w-9 overflow-hidden rounded bg-black/70"><div className="h-full" style={{ width: `${(show ? f : 1) * 100}%`, background: show ? hpColor(f) : '#64748b' }} /></div>
            {i === 0 && <div className="font-mono text-[7px] font-bold tracking-widest text-amber-300">NOW</div>}
          </div>
        );
      })}
    </div>
  );
}

export function UnitCard({ u, units }: { u: BU; units: BU[] }) {
  const f = Math.max(0, u.hp / u.maxHp), known = u.team === 'player' || u.scanned;
  const fx: string[] = [];
  if (u.shield > 0) fx.push(`SHIELD ${u.shield}`);
  if (u.suit > 0) fx.push('HULL SUIT');
  if (u.marked > 0) fx.push('MARKED');
  if (u.atkUp > 0) fx.push('ATK+');
  if (u.defUp > 0) fx.push('DEF+');
  if (u.defDown > 0) fx.push('DEF-');
  if (u.steady) fx.push('STEADY');
  const stat = (k: string, v: number | string) => (
    <div className="rounded bg-white/5 px-1.5 py-0.5 text-center">
      <div className="hud-label !text-[7px] !tracking-[0.2em]">{k}</div>
      <div className="font-mono text-[12px] font-bold">{v}</div>
    </div>
  );
  return (
    <div className="glass px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2" style={{ borderColor: u.team === 'player' ? '#2de2d0' : '#ff4d5e', background: 'linear-gradient(160deg,#10222e,#080d18)' }}>
          <GIcon name={u.icon} size={24} style={{ color: u.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-black leading-tight">{u.name}</div>
          <div className="hud-label !tracking-[0.18em]">{u.jobName} · LV {u.level} · {u.team === 'player' ? 'ALLY' : 'HOSTILE'}</div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-black/70"><div className="h-full transition-all" style={{ width: `${(known ? f : 1) * 100}%`, background: known ? hpColor(f) : '#64748b' }} /></div>
          <div className="font-mono text-[10px] text-slate-300">{known ? `HP ${Math.max(0, u.hp)} / ${u.maxHp}` : 'HP ??? — scan to reveal'}</div>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        {stat('ATK', `${u.atk}+${u.wAtk}`)}
        {stat('DEF', effDef(u, units))}
        {stat('SPD', u.spd)}
        {stat('MAG', u.mag)}
        {u.team === 'player' ? stat('FLASH', u.flash) : stat('RNG', `${u.wRange[0]}-${u.wRange[1]}`)}
      </div>
      {(fx.length > 0 || (u.team === 'enemy' && u.scanned)) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {u.team === 'enemy' && u.scanned && <span className="chip bg-red-400/15 text-red-200">WEAK: {u.weak}</span>}
          {fx.map(x => <span key={x} className="chip bg-cyan-400/15 text-cyan-200">{x}</span>)}
        </div>
      )}
    </div>
  );
}

interface ActionProps {
  u: BU; panel: Panel; selAction: string | null; hasFire: boolean; hasArty: boolean; hasAir: boolean; artyLeft: number;
  onMove(): void; onAttack(): void; onSkills(): void; onFire(): void; onWait(): void; onBack(): void;
  onAbility(a: JobAbility): void; onFireKind(k: 'arty' | 'air'): void;
}

/** Action menu. The unit has one ACTION (attack / ability / fire) and one MOVE, in either order. */
export function ActionPanel(p: ActionProps) {
  const { u, panel, selAction } = p;
  const acted = u.acted, moved = u.moved;

  const Act = ({ label, k, icon, on, active, disabled, tone }: { label: string; k?: string; icon: string; on(): void; active?: boolean; disabled?: boolean; tone?: string }) => (
    <button disabled={disabled} onClick={on} title={k ? `[${k}]` : undefined} className={`btn !min-h-[40px] flex-col !gap-0 !text-[10px] ${active ? 'btn-on' : ''} ${tone ?? ''}`}>
      <GIcon name={icon} size={15} />{label}{k && <span className="font-mono text-[7px] font-normal opacity-60">{k}</span>}
    </button>
  );
  const status = (done: boolean, label: string, tone: string) => (
    <span className={`chip ${done ? 'bg-white/5 text-slate-500 line-through' : tone}`}>{done && <GIcon name="check" size={10} />}{label}</span>
  );
  const hint =
    selAction === 'move' ? 'Cyan tiles: choose where to go.' :
    selAction === 'attack' ? `${u.wName} [${u.wRange[0]}-${u.wRange[1]}] — click a red tile with a hostile.` :
    selAction?.startsWith('ab:') ? 'Click a highlighted tile.' :
    selAction ? 'Click a tile to call fire.' :
    acted && moved ? 'Turn complete.' :
    acted ? 'Action spent. Move now, or END TURN.' :
    moved ? 'Moved. Attack or use an ability, or END TURN.' :
    'Move and act in either order. The turn ends after both, or END TURN early.';

  return (
    <div className="glass px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="hud-label mr-auto">Turn economy</span>
        {status(moved, 'MOVE', 'bg-cyan-400/15 text-cyan-200')}
        {status(acted, 'ACTION', 'bg-amber-400/15 text-amber-200')}
      </div>

      {panel === 'main' && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Act label="MOVE" k="M" icon="footprints" on={p.onMove} active={selAction === 'move'} disabled={moved} />
            <Act label="ATTACK" k="A" icon="swords" on={p.onAttack} active={selAction === 'attack'} disabled={acted} />
            <Act label="ABILITY" k="S" icon="sparkles" on={p.onSkills} disabled={acted} />
            <Act label="FIRE" k="F" icon="bomb" on={p.onFire} disabled={!p.hasFire || acted} />
            <Act label={acted ? 'END TURN' : 'WAIT'} k="W" icon="timer" on={p.onWait} />
            <Act label="BACK" k="Esc" icon="chevron" on={p.onBack} disabled={!selAction} />
          </div>
          <div className="hud-body mt-1.5 !text-[10px] text-slate-400">{hint}</div>
        </>
      )}

      {panel === 'skills' && (
        <>
          <div className="mb-1.5 flex items-center justify-between">
                    <span className="hud-label !text-violet-300">SKILL SLOTS · {u.abilities.length}/6</span>
            <button className="btn !min-h-[24px] !px-2" onClick={p.onBack}>BACK</button>
          </div>
          <div className="space-y-1">
            {u.abilities.length === 0 && <div className="hud-body !text-[11px] text-slate-500">No slotted skills — assign up to six learned abilities on the Party screen.</div>}
            {u.abilities.map(a => {
              const passive = a.kind === 'passive';
              return (
                <button key={a.id} disabled={passive || acted || (a.flash && u.flash <= 0)} onClick={() => p.onAbility(a)}
                  className={`btn !h-auto w-full !flex-col !items-start !gap-0 !py-1 text-left ${selAction === 'ab:' + a.id ? 'btn-on' : ''}`}>
                  <span className="flex items-center gap-1 text-[11px]"><GIcon name={a.flash ? 'zap' : passive ? 'shield' : 'chevron'} size={11} />{a.name}{passive && <span className="font-mono text-[8px] opacity-60"> (passive)</span>}</span>
                  <span className="truncate text-[9px] font-medium opacity-70">{a.desc}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {panel === 'fire' && (
        <>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="hud-label !text-red-300">FIRE SUPPORT · {p.artyLeft} MISSIONS</span>
            <button className="btn !min-h-[24px] !px-2" onClick={p.onBack}>BACK</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Act label="ARTILLERY" icon="bomb" on={() => p.onFireKind('arty')} disabled={!p.hasArty || p.artyLeft <= 0 || acted} active={selAction === 'arty'} />
            <Act label="AIRSTRIKE" icon="plane" on={() => p.onFireKind('air')} disabled={!p.hasAir || p.artyLeft <= 0 || acted} active={selAction === 'air'} />
          </div>
        </>
      )}
    </div>
  );
}

export function LogPanel({ log }: { log: string[] }) {
  return (
    <div className="glass min-h-0 flex-1 overflow-hidden px-2.5 py-1.5">
      <div className="hud-label mb-0.5">Combat log</div>
      <div className="flex h-[calc(100%-14px)] flex-col justify-end gap-px overflow-hidden font-mono text-[10px] leading-snug">
        {log.slice(-8).map((l, i, a) => <div key={i} className="truncate" style={{ opacity: 0.45 + (i / a.length) * 0.55, color: i === a.length - 1 ? '#e6f6ff' : '#94a3b8' }}>› {l}</div>)}
      </div>
    </div>
  );
}

export function HoverCard({ u }: { u: BU }) {
  const known = u.team === 'player' || u.scanned, f = Math.max(0, u.hp / u.maxHp);
  return (
    <div className="glass pointer-events-none absolute bottom-2 left-2 z-20 w-[210px] px-2.5 py-1.5">
      <div className="flex items-center gap-2"><GIcon name={u.icon} size={16} style={{ color: u.color }} /><span className="truncate text-[12px] font-black">{u.name}</span><span className="hud-label ml-auto">LV {u.level}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-black/70"><div className="h-full" style={{ width: `${(known ? f : 1) * 100}%`, background: known ? hpColor(f) : '#64748b' }} /></div>
      <div className="mt-0.5 font-mono text-[9px] text-slate-300">{known ? `${Math.max(0, u.hp)}/${u.maxHp}` : '???'} · {u.jobName}{u.team === 'enemy' && u.scanned ? ` · weak ${u.weak}` : ''}</div>
    </div>
  );
}

export function Floaters({ items }: { items: Floater[] }) {
  return <>{items.map(f => <div key={f.id} className="floater" style={{ left: f.x, top: f.y, color: f.color }}>{f.text}</div>)}</>;
}

export function ResultModal({ kind, title, lines, onClick, cta }: { kind: 'victory' | 'defeat'; title: string; lines: string[]; onClick(): void; cta: string }) {
  const win = kind === 'victory';
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/65 p-4">
      <div className="glass w-[min(440px,90%)] p-5 text-center" style={{ borderColor: win ? 'rgba(110,231,183,.5)' : 'rgba(248,113,113,.5)' }}>
        <GIcon name={win ? 'trophy' : 'skull'} size={40} className={`mx-auto ${win ? 'text-emerald-300' : 'text-red-300'}`} />
        <div className={`mt-1 text-xl font-black tracking-wide ${win ? 'text-emerald-300' : 'text-red-300'}`}>{title}</div>
        {lines.map((l, i) => <p key={i} className="hud-body mt-1">{l}</p>)}
        <button onClick={onClick} className={`btn mt-3 w-full !min-h-[42px] !text-[13px] ${win ? 'btn-primary' : 'btn-danger'}`}>{cta}</button>
      </div>
    </div>
  );
}
