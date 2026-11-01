import { useState } from 'react';
import { useGame, baseStats } from '../game/store';
import { JOBS, SHIELD_OK, SKILL_SLOT_COUNT, abilityById, isSlottableAbility, jobById, jobCostTotal, type Job } from '../game/jobs';
import { itemById, type Slot } from '../game/gear';
import GIcon from '../ui/GameIcon';
import { HudBar, Pager, usePager } from '../ui/Glass';

type Tab = 'skills' | 'job' | 'gear';
const SLOTS: Slot[] = ['weapon', 'helmet', 'armor', 'shield', 'accessory'];

/** Party command. Three tabs, no scrolling: jobs fit a grid, six skill slots plus the job tree, gear is paged. */
export default function PartyScreen() {
  const g = useGame();
  const [sel, setSel] = useState('rye');
  const [tab, setTab] = useState<Tab>('skills');
  const [slot, setSlot] = useState<Slot>('weapon');
  const c = g.party.find(p => p.id === sel) ?? g.party[0];
  const equippedIds = c ? (Object.values(c.equip).filter(Boolean) as string[]) : [];
  const owned = [...new Set([...g.inventory, ...equippedIds])].filter(id => itemById(id).slot === slot);
  const pager = usePager(owned, 6);
  if (!c) return null;
  const s = baseStats(c), job = jobById(c.jobId);

  const availJobs: Job[] = JOBS.filter(j => {
    if (!j.unique) return true;
    if (j.id === 'carbon-king' && c.id === 'rye' && (g.visited.includes('cheyenne-mtn') || c.jp['carbon-king'] !== undefined)) return true;
    if (j.id === 'ghost-signal' && c.id === 'maya') return true;
    if (j.id === 'echo-vessel' && c.id === 'echo') return true;
    return j.id === c.jobId;
  });
  const weapon = c.equip.weapon ? itemById(c.equip.weapon) : null;
  const shieldOk = job.canShield && (!weapon?.weaponType || SHIELD_OK[weapon.weaponType]);
  const learnedSkills = c.learned.map(id => abilityById(id)).filter(isSlottableAbility);
  const slottedCount = c.skillSlots.filter(Boolean).length;

  return (
    <div className="flex h-full flex-col bg-[#060b16] text-slate-100">
      <HudBar back title="Party command" icon="users" sub="jobs · abilities · gear" right={<span className="chip bg-amber-400/15 text-amber-300"><GIcon name="coins" size={12} />{g.gold}G</span>} />
      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr] gap-2 p-2">
        <div className="glass flex min-h-0 flex-col gap-1 overflow-hidden p-1.5">
          <div className="hud-label px-1">Active ({g.party.length}/6)</div>
          {g.party.map(p => {
            const ps = baseStats(p);
            return (
              <button key={p.id} onClick={() => setSel(p.id)} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ${p.id === c.id ? 'bg-cyan-400/20 ring-1 ring-cyan-300' : 'bg-white/5 hover:bg-white/10'}`}>
                <GIcon name={p.icon} size={20} style={{ color: p.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold leading-none">{p.name}</span>
                  <span className="font-mono text-[9px] text-slate-400">Lv{p.level} {jobById(p.jobId).name}</span>
                  <span className="mt-0.5 block h-1 overflow-hidden rounded bg-black/60"><span className="block h-full bg-emerald-400" style={{ width: `${(p.hp / ps.maxHp) * 100}%` }} /></span>
                </span>
              </button>
            );
          })}
          {g.reserves.length > 0 && <div className="hud-label px-1 pt-1">Reserves</div>}
          {g.reserves.map(p => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-1.5 py-1 text-[11px]">
              <GIcon name={p.icon} size={15} style={{ color: p.color }} /><span className="truncate">{p.name}</span>
              <button onClick={() => g.promoteReserve(p.id)} className="btn ml-auto !min-h-[22px] !px-2 !text-[9px]">ADD</button>
            </div>
          ))}
          {!['rye', 'june', 'echo'].includes(c.id) && <button onClick={() => { g.dismissToReserve(c.id); setSel('rye'); }} className="btn mt-auto !text-[10px]">SEND TO RESERVES</button>}
        </div>

        <div className="glass flex min-h-0 flex-col gap-2 p-2.5">
          <div className="flex items-center gap-2.5">
            <GIcon name={c.icon} size={32} style={{ color: c.color }} />
            <div className="leading-tight">
              <div className="text-[15px] font-black">{c.name} <span className="font-mono text-[10px] font-normal text-slate-400">Lv{c.level} · {c.xp}/{c.level * 100} XP</span></div>
              <div className="font-mono text-[10px] text-slate-300">HP {c.hp}/{s.maxHp} · ATK {s.atk} DEF {s.def} SPD {s.spd} MAG {s.mag} · MV {s.move} JMP {s.jump}</div>
            </div>
            {c.mastered.length > 0 && <span className="chip ml-3 bg-amber-300/20 text-amber-200">MASTERED: {c.mastered.join(', ')}</span>}
            <div className="ml-auto flex gap-1">
              {(['skills', 'job', 'gear'] as Tab[]).map(t => <button key={t} onClick={() => setTab(t)} className={`btn !min-h-[34px] !px-4 uppercase ${tab === t ? 'btn-primary' : ''}`}>{t}</button>)}
            </div>
          </div>

          {tab === 'skills' && (
            <div className="min-h-0 flex-1 space-y-1.5">
              <div>
                <div className="hud-label !text-cyan-300">SKILL SLOTS {slottedCount}/{SKILL_SLOT_COUNT} — any learned active/flash ability, any job</div>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => c.skillSlots[i] ?? null).map((id, i) => {
                    const current = id ? abilityById(id) : undefined;
                    return (
                      <label key={i} className={`block rounded-lg px-2 py-1.5 ${id ? 'bg-cyan-400/10 ring-1 ring-cyan-300/50' : 'bg-white/5'}`}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="hud-label !text-[8px]">SLOT {i + 1}</span>
                          {id && <button onClick={() => g.assignSkillSlot(c.id, i, null)} className="font-mono text-[9px] text-slate-400 hover:text-red-300">CLEAR</button>}
                        </div>
                        <select
                          value={id ?? ''}
                          onChange={e => g.assignSkillSlot(c.id, i, e.target.value || null)}
                          className="mt-1 w-full truncate rounded bg-black/45 px-1.5 py-1 text-[11px] font-bold text-slate-100 outline-none ring-1 ring-white/10"
                        >
                          <option value="">— empty —</option>
                          {learnedSkills.map(a => (
                            <option key={a.id} value={a.id} disabled={c.skillSlots.includes(a.id) && id !== a.id}>
                              {a.flash ? '⚡ ' : ''}{a.name}
                            </option>
                          ))}
                        </select>
                        {current && <div className="mt-0.5 truncate font-mono text-[8px] text-slate-500">RNG {current.range} · AOE {current.aoe}</div>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="hud-label !text-violet-300">{c.jp[c.jobId] ?? 0} JP banked in {job.name} · mastery uses lifetime JP · +{job.masteryBonus}</div>
              {job.abilities.map(a => {
                const learned = c.learned.includes(a.id), afford = (c.jp[c.jobId] ?? 0) >= a.jpCost;
                const slotted = c.skillSlots.includes(a.id);
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${learned ? 'bg-emerald-400/10 ring-1 ring-emerald-400/40' : 'bg-white/5'}`}>
                    <GIcon name={a.flash ? 'zap' : a.kind === 'passive' ? 'shield' : 'chevron'} size={15} className={a.flash ? 'text-cyan-300' : 'text-slate-400'} />
                    <div className="flex-1 leading-tight"><b className="text-[12px]">{a.name}</b> <span className="hud-body !text-[11px] text-slate-400">{a.desc}</span>
                      <span className="ml-1 font-mono text-[9px] text-slate-500">PWR {a.power} · RNG {a.range} · AOE {a.aoe}</span></div>
                    {learned
                      ? slotted
                        ? <span className="chip bg-cyan-400/15 text-cyan-200">SLOTTED</span>
                        : a.kind === 'passive'
                          ? <span className="chip bg-emerald-400/15 text-emerald-300">PASSIVE</span>
                          : <button onClick={() => g.assignSkillSlot(c.id, -1, a.id)} className="btn !min-h-[28px]">SLOT ▸</button>
                      : <button disabled={!afford} onClick={() => g.learnAbility(c.id, a.id)} className="btn btn-primary !min-h-[28px]">{a.jpCost} JP</button>}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'job' && (
            <div className="min-h-0 flex-1">
              <div className="grid grid-cols-4 gap-1.5">
                {availJobs.map(j => {
                  const life = c.jpEarned[j.id] ?? 0, total = jobCostTotal(j.id), mastered = c.mastered.includes(j.id);
                  return (
                    <button key={j.id} onClick={() => g.switchJob(c.id, j.id)} className={`rounded-lg border p-2 text-left ${c.jobId === j.id ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="flex items-center gap-1 text-[12px] font-bold"><GIcon name={j.icon} size={14} style={{ color: j.color }} />{j.name}{mastered && <GIcon name="star" size={11} className="ml-auto text-amber-300" />}</div>
                      <div className="font-mono text-[9px] text-slate-400">{j.weapons.join('/')} · MV{j.move}</div>
                      {!j.unique && <><div className="mt-1 h-1 overflow-hidden rounded bg-black/60"><div className="h-full bg-violet-400" style={{ width: `${Math.min(100, (life / Math.max(1, total)) * 100)}%` }} /></div><div className="font-mono text-[8px] text-slate-500">{life}/{total} JP lifetime</div></>}
                    </button>
                  );
                })}
              </div>
              <div className="hud-body mt-2 rounded-lg bg-white/5 px-2.5 py-1.5"><b style={{ color: job.color }}>{job.name}</b> — {job.desc} <span className="text-amber-200/90">Master bonus: {job.masteryBonus}</span></div>
            </div>
          )}

          {tab === 'gear' && (
            <div className="grid min-h-0 flex-1 grid-cols-[190px_1fr] gap-2">
              <div className="space-y-1">
                {SLOTS.map(sl => (
                  <button key={sl} onClick={() => { setSlot(sl); pager.setPage(0); }} className={`w-full rounded-lg px-2 py-1.5 text-left ${slot === sl ? 'bg-cyan-400/20 ring-1 ring-cyan-300' : 'bg-white/5 hover:bg-white/10'}`}>
                    <div className="hud-label !text-[8px]">{sl}</div>
                    <div className="truncate text-[11px] font-bold">{c.equip[sl] ? itemById(c.equip[sl]!).name : '— none —'}</div>
                  </button>
                ))}
                <div className="hud-body !text-[9px] text-slate-500">Shields pair only with one-handed melee (sword / mace). {slot === 'shield' && !shieldOk && <b className="text-amber-300">Not usable right now.</b>}</div>
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="grid flex-1 grid-cols-2 content-start gap-1.5">
                  {pager.items.map(id => {
                    const it = itemById(id), cur = c.equip[slot] === id;
                    const bad = (it.slot === 'weapon' && it.weaponType && !job.weapons.includes(it.weaponType)) || (it.slot === 'shield' && !shieldOk);
                    return (
                      <button key={id} disabled={!!bad} onClick={() => g.equipItem(c.id, id)} className={`rounded-lg p-2 text-left ${cur ? 'bg-cyan-400/15 ring-1 ring-cyan-300' : 'bg-white/5 hover:bg-white/10'} disabled:opacity-35`}>
                        <div className="flex items-center gap-1 text-[12px] font-bold">{it.name}{cur && <GIcon name="check" size={12} className="ml-auto text-cyan-300" />}</div>
                        <div className="font-mono text-[9px] text-cyan-300">{it.weaponType ?? it.slot} {it.atk ? `· +${it.atk} ATK ` : ''}{it.def ? `· +${it.def} DEF ` : ''}{it.mag ? `· +${it.mag} MAG ` : ''}{it.spd ? `· +${it.spd} SPD ` : ''}{it.hp ? `· +${it.hp} HP` : ''}</div>
                        <div className="truncate text-[9px] text-slate-400">{bad ? `${job.name} can't use this` : it.desc}</div>
                      </button>
                    );
                  })}
                  {owned.length === 0 && <div className="hud-body col-span-2 text-slate-500">Nothing owned for this slot — visit the shop.</div>}
                </div>
                <Pager page={pager.page} pages={pager.pages} setPage={pager.setPage} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
