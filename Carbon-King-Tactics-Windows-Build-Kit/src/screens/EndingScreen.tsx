import { useGame } from '../game/store';
import { WORLD_NODE_COUNT } from '../game/world';
import GIcon from '../ui/GameIcon';
import FullscreenButton from '../ui/Fullscreen';
import AudioButton from '../ui/AudioButton';

export default function EndingScreen() {
  const g = useGame();
  const stat = (icon: string, v: string) => <div className="glass flex items-center gap-2 px-3 py-2 font-mono text-[11px]"><GIcon name={icon} size={15} className="text-teal-300" />{v}</div>;
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#060b16] p-4 text-slate-100">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,.16), transparent 60%)' }} />
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5"><AudioButton /><FullscreenButton /></div>
      <div className="relative grid w-full max-w-4xl grid-cols-[1fr_240px] items-center gap-4">
        <div>
          <div className="hud-label !text-amber-300">Final · summit · Pikes Peak · 14,115 ft</div>
          <h1 className="mt-1 flex items-center gap-2 text-4xl font-black"><GIcon name="crown" size={38} className="text-amber-300" />KING OF THE WORLD</h1>
          <div className="hud-body mt-2 space-y-2 !text-[12.5px] !leading-relaxed">
            <p>The purge fire dies halfway up the mountain — out of fuel, out of hate. Rye opens his skull to everybody at once: digitals, humans, the elk herd on the Barr Trail. <i>Tokens in. Current up. Crown on.</i></p>
            <p>He doesn't rule. He <b className="text-white">hosts the vote</b> — a living tiebreaker for a planet learning to think together. Maya runs the Lattice schools. June runs the clinics (and still roasts everyone). Seven finally gets hands — two of them, both left. Silas sends an invoice to the entire world. The world pays it. It feels fair.</p>
            <p>Governor-Mother Imogen retires to Trinidad Lake with a fishing rod and an unlisted halo. Bishop Voss's chapel becomes a library. The Choir hums low over Colorado every evening at dusk, and if you listen close, it's laughing.</p>
            <p><b className="text-amber-200">Rye was only right because you were playing as him. Remember that. Now — be a good king.</b></p>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => g.openSaves('ending')} className="btn btn-primary !min-h-[42px] flex-1 !text-[13px]"><GIcon name="save" size={14} />SAVE ARCHIVE</button>
            <button onClick={() => g.setScreen('map')} className="btn !min-h-[42px] flex-1 !text-[13px]">FREE ROAM COLORADO</button>
            <button onClick={g.startGame} className="btn btn-gold !min-h-[42px] flex-1 !text-[13px]">NEW GAME+</button>
          </div>
        </div>
        <div className="space-y-2">
          {stat('swords', `${g.battlesWon} battles won`)}{stat('map', `${g.visited.length}/${WORLD_NODE_COUNT} nodes`)}{stat('coins', `${g.gold}G hoarded`)}
          <div className="glass p-2.5">
            <div className="hud-label">Final party</div>
            <div className="mt-1 space-y-1">
              {g.party.map(p => <div key={p.id} className="flex items-center gap-1.5 text-[11px]"><GIcon name={p.icon} size={14} style={{ color: p.color }} /><b>{p.name}</b><span className="ml-auto font-mono text-[10px] text-slate-400">Lv{p.level}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
