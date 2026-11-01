import { useState } from 'react';
import { useGame } from '../game/store';
import { JOBS } from '../game/jobs';
import { SHOP, itemById } from '../game/gear';
import GIcon from '../ui/GameIcon';
import { HudBar, Pager, usePager } from '../ui/Glass';

/** Shop and Tavern: paged / gridded so nothing scrolls inside the 16:9 stage. */

const CATS = [
  { label: 'BLADES', icon: 'sword', ids: SHOP.filter(i => ['Sword', 'Spear', 'Mace'].includes(i.weaponType ?? '')).map(i => i.id) },
  { label: 'GUNS', icon: 'crosshair', ids: SHOP.filter(i => ['Pistol', 'SMG', 'Assault', 'LongRifle'].includes(i.weaponType ?? '')).map(i => i.id) },
  { label: 'ENERGY', icon: 'zap', ids: SHOP.filter(i => i.weaponType === 'DEW').map(i => i.id) },
  { label: 'GEAR', icon: 'shield', ids: SHOP.filter(i => ['helmet', 'armor', 'shield', 'accessory'].includes(i.slot)).map(i => i.id) },
];

export function ShopScreen() {
  const g = useGame();
  const [cat, setCat] = useState(0);
  const pager = usePager(CATS[cat].ids, 12);
  return (
    <div className="flex h-full flex-col bg-[#060b16] text-slate-100">
      <HudBar back title="General store" icon="shop" sub="Walsenburg Supply"
        right={<span className="chip bg-amber-400/15 text-amber-300"><GIcon name="coins" size={12} />{g.gold}G · {g.inventory.length} owned</span>} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="flex gap-1.5">
          {CATS.map((c, i) => <button key={c.label} onClick={() => { setCat(i); pager.setPage(0); }} className={`btn !min-h-[36px] !px-5 ${cat === i ? 'btn-primary' : ''}`}><GIcon name={c.icon} size={14} />{c.label}</button>)}
        </div>
        <div className="glass flex min-h-0 flex-1 flex-col p-2">
          <div className="grid flex-1 grid-cols-2 content-start gap-2">
            {pager.items.map(id => {
              const it = itemById(id), n = g.inventory.filter(x => x === id).length, ok = g.gold >= it.price;
              return (
                <div key={id} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
                  <GIcon name={it.slot === 'weapon' ? 'swords' : it.slot === 'shield' ? 'shield' : it.slot === 'accessory' ? 'sparkles' : 'hardhat'} size={22} className="shrink-0 text-teal-300" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-bold">{it.name} <span className="font-mono text-[9px] font-normal text-slate-500">{it.weaponType ?? it.slot}{n ? ` · own ${n}` : ''}</span></div>
                    <div className="truncate text-[10px] text-slate-400">{it.desc}</div>
                    <div className="font-mono text-[10px] text-cyan-300">{it.atk ? `+${it.atk} ATK ` : ''}{it.def ? `+${it.def} DEF ` : ''}{it.mag ? `+${it.mag} MAG ` : ''}{it.spd ? `+${it.spd} SPD ` : ''}{it.hp ? `+${it.hp} HP` : ''}</div>
                  </div>
                  <button disabled={!ok} onClick={() => g.buyItem(id)} className="btn btn-gold !min-h-[36px] !min-w-[72px]">{it.price}G</button>
                </div>
              );
            })}
          </div>
          <Pager page={pager.page} pages={pager.pages} setPage={pager.setPage} />
        </div>
      </div>
    </div>
  );
}

export function TavernScreen() {
  const g = useGame();
  return (
    <div className="flex h-full flex-col bg-[#060b16] text-slate-100">
      <HudBar back title="Halo tavern" icon="beer" sub="hire stock recruits · 250G each"
        right={<span className="chip bg-amber-400/15 text-amber-300"><GIcon name="coins" size={12} />{g.gold}G · roster {g.party.length + g.reserves.length}/12</span>} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="hud-body">Blank-slate recruits start in the job you pick. Major characters join through the story.</div>
        <div className="glass grid flex-1 grid-cols-2 content-start gap-2 p-2">
          {JOBS.filter(j => !j.unique).map(j => (
            <div key={j.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
              <GIcon name={j.icon} size={26} style={{ color: j.color }} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] font-bold">{j.name} <span className="font-mono text-[9px] font-normal text-slate-500">{j.weapons.join('/')} · MV{j.move} JMP{j.jump}</span></div>
                <div className="truncate text-[10px] text-slate-400">{j.desc}</div>
              </div>
              <button disabled={g.gold < 250} onClick={() => g.hireStock(j.id)} className="btn btn-primary !min-h-[36px] !min-w-[64px]">HIRE</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
