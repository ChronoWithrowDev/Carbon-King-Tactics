import { useEffect, useRef } from 'react';
import { BattleScene } from './BattleScene';
import { useBattle } from './useBattle';
import { HudBar } from '../ui/Glass';
import GIcon from '../ui/GameIcon';
import FlashOverlay from './FlashOverlay';
import { ActionPanel, Floaters, HoverCard, LogPanel, ResultModal, TurnOrder, UnitCard } from './BattleHud';
import { sound } from '../lib/sound';

/** Thin view: mounts the 3D scene, wires input, lays out the HUD. All rules live in useBattle. */
export default function BattleView() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const b = useBattle(sceneRef);

  const bootRef = useRef(b);
  bootRef.current = b;

  useEffect(() => {
    const cur = bootRef.current;
    const scene = new BattleScene(mountRef.current!, cur.bmap, cur.nodeId);
    sceneRef.current = scene;
    scene.onTile = (x, z) => bootRef.current.tileRef.current(x, z);
    scene.onHover = cur.setHover;
    cur.syncNow();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, []);

  const { g, active, phase } = b;
  const scene = () => sceneRef.current;
  const tool = (label: string, icon: string, on: () => void) => <button className="btn" onClick={on}><GIcon name={icon} size={12} />{label}</button>;
  const modeLabel = b.selAction === 'attack' ? 'ATTACK' : b.selAction === 'move' ? 'MOVE' : b.selAction === 'arty' ? 'ARTILLERY' : b.selAction === 'air' ? 'AIRSTRIKE' : b.selAbility?.name.toUpperCase();

  return (
    <div className="relative flex h-full flex-col bg-[#060b16] text-slate-100">
      <HudBar
        title={b.node.name} icon="swords" sub={`Round ${b.round} · ${b.theme.label} · ${b.node.region}`}
        right={<>
          {tool('ROT', 'rotate', () => scene()?.rotate(Math.PI / 4))}
          {tool('OUT', 'minus', () => scene()?.zoom(2))}
          {tool('IN', 'plus', () => scene()?.zoom(-2))}
          <button className="btn btn-danger" onClick={() => g.loseBattle()}>RETREAT</button>
        </>}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-2 p-2">
        <div className="glass relative min-h-0 overflow-hidden !rounded-xl">
          <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />
          <TurnOrder order={b.order} units={b.units} turnPos={b.turnPos} />
          <Floaters items={b.floaters} />
          {b.hoverUnit && <HoverCard u={b.hoverUnit} />}
          <div className="hud-label pointer-events-none absolute bottom-2 right-2 z-20 rounded bg-black/55 px-2 py-1 !text-[9px]">
            drag rotate · wheel zoom{modeLabel && <span className="text-amber-300"> · {modeLabel}</span>}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          {active && <UnitCard u={active} units={b.units} />}
          {active && b.isPlayerTurn && (
            <ActionPanel
              u={active} panel={b.panel} selAction={b.selAction} artyLeft={b.artyLeft}
              hasFire={g.hasArtillery || g.hasAirstrike} hasArty={g.hasArtillery} hasAir={g.hasAirstrike}
              onMove={b.selectMove} onAttack={b.selectAttack} onSkills={() => b.setPanel('skills')} onFire={() => b.setPanel('fire')}
              onWait={b.wait} onBack={b.back} onAbility={b.selectAbility} onFireKind={b.selectFire}
            />
          )}
          {active && !b.isPlayerTurn && phase === 'fight' && (
            <div className="glass px-3 py-3 text-center"><div className="hud-label animate-pulse !text-red-300">hostile turn</div><div className="hud-body mt-0.5 !text-[11px]">{active.name} is acting…</div></div>
          )}
          <LogPanel log={b.log} />
        </div>
      </div>

      {phase === 'victory' && (
        <ResultModal kind="victory" title={`VICTORY — ${b.node.name.toUpperCase()} TAKEN`} cta="COLLECT — RETURN TO MAP" onClick={() => { sound.playVictoryFanfare(); b.claimVictory(); }}
          lines={[`+${b.rewards.xp} XP · +${b.rewards.jp} JP · +${b.rewards.gold}G`, ...(b.hasScavenge ? ['Includes the Scavenge gold bonus.'] : []), ...(b.node.isBase ? ['BASE CAPTURED — fire support authority expanded.'] : [])]} />
      )}
      {phase === 'defeat' && (
        <ResultModal kind="defeat" title="SQUAD WIPED" cta="RETREAT TO MAP" onClick={() => g.loseBattle()} lines={['The Choir rewinds you. No permadeath — only pride damage.']} />
      )}
      {b.flashPlay && (
        <FlashOverlay abilityName={b.flashPlay.ability} user={b.flashPlay.user} onDone={b.finishFlash} />
      )}
    </div>
  );
}
