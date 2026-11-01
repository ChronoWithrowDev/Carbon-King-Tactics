import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '../game/store';
import { latestSave } from '../game/saves';
import { nodeById, WORLD_NODE_COUNT } from '../game/world';
import { genMap } from '../game/terrain';
import { createStageKit } from '../three/stage';
import { spawnCast, animateCast } from '../three/cinematic';
import GIcon from '../ui/GameIcon';
import FullscreenButton from '../ui/Fullscreen';
import AudioButton from '../ui/AudioButton';

/** Title: live 3D red-rock dusk with the party, glass menu on top. */
export default function TitleScreen() {
  const g = useGame();
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useMemo(() => latestSave(), [g.saveRev]);

  useEffect(() => {
    const el = mountRef.current!;
    const bmap = genMap(nodeById('garden-gods'), 11);
    const kit = createStageKit(el, bmap, 'title');
    const cast = spawnCast(kit, bmap, ['JUNE', 'RYE', 'SEVEN', 'SILAS'], 'line');
    kit.setFrame((t, dt, now) => {
      // the whole shot is shifted left so the party sits in the right 60% of the frame, clear of the menu
      const th = 0.25 + Math.sin(t * 0.09) * 0.32, R = 8.2, off = -1.9;
      kit.camera.position.set(Math.sin(th) * R + off, 2.5 + Math.sin(t * 0.17) * 0.12, 2.2 + Math.cos(th) * R);
      kit.camera.lookAt(off, 1.15, 2.2);
      animateCast(cast, t, dt, now, '', kit.camera);
    });
    return () => kit.dispose();
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-[#060b16] text-slate-100">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(4,8,16,.9) 0%, rgba(4,8,16,.55) 34%, transparent 62%), linear-gradient(0deg, rgba(4,8,16,.85), transparent 28%)' }} />
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5"><AudioButton /><FullscreenButton label /></div>

      <div className="absolute left-[5%] top-1/2 z-10 w-[min(430px,44%)] -translate-y-1/2">
        <div className="hud-label !text-teal-300">Near-future Colorado · 2041 · A tactical RPG</div>
        <h1 className="mt-2 text-[clamp(32px,6.2cqw,66px)] font-black leading-[0.95] tracking-tight" style={{ textShadow: '0 4px 30px rgba(0,0,0,.6)' }}>
          CARBON KING
          <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">TACTICS</span>
        </h1>
        <p className="hud-body mt-3 !text-[12.5px] !leading-relaxed">
          Humans rent their brains as <b className="text-white">carbon nodes</b> for digital people who <b className="text-teal-300">flash-infer at will</b> and
          {' '}<b className="text-emerald-300">synthesize matter from raw elements</b>. {WORLD_NODE_COUNT} real Colorado nodes. A heist that ends with you as <b className="text-amber-300">King of the World</b>.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {latest && (
            <button
              onClick={g.continueLatest}
              className="btn btn-primary !min-h-[48px] !justify-between !px-5 !text-[14px] !tracking-[0.1em]"
            >
              <span className="flex items-center gap-2"><GIcon name="play" size={17} />CONTINUE</span>
              <span className="truncate font-mono text-[10px] font-bold opacity-85">
                {latest.summary.locationName} · {latest.summary.visitedCount}/{WORLD_NODE_COUNT}
              </span>
            </button>
          )}
          <button
            onClick={g.startGame}
            className={`btn ${latest ? '' : 'btn-gold'} !min-h-[44px] !justify-start !px-5 !text-[14px] !tracking-[0.12em]`}
          >
            <GIcon name="crown" size={17} />NEW GAME
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => g.openSaves('title')}
              className="btn !min-h-[38px] !justify-start !px-4 !text-[11.5px]"
            >
              <GIcon name="folder" size={15} />LOAD / ARCHIVE
            </button>
            <FullscreenButton label className="!min-h-[38px] !justify-start !px-4 !text-[11.5px]" />
          </div>
        </div>
        <div className="hud-label mt-3.5 !text-[8px] !tracking-[0.2em]">3-unit start · autosave + manual slots · revisits: 35% ambush · landscape 16:9</div>
      </div>
      <div className="hud-label absolute bottom-2 left-1/2 z-10 -translate-x-1/2 !text-[8px]">A love letter to Final Fantasy Tactics, set under the Spanish Peaks</div>
    </div>
  );
}
