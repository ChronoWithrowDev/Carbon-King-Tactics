import { baseStats, type Character } from '../game/store';
import { JOBS, SKILL_SLOT_COUNT, abilityById, isSlottableAbility, jobById, WEAPON_INFO } from '../game/jobs';
import { itemById } from '../game/gear';
import type { WorldNode } from '../game/world';
import { mulberry, hashStr } from '../lib/rng';
import type { BU } from './types';

// explicit spawn tiles (all inside the 9x9 grid, on the low spawn rows)
const PLAYER_SPAWNS: [number, number][] = [[2, 7], [4, 7], [6, 7], [3, 8], [5, 8]];
const ENEMY_SPAWNS: [number, number][] = [[4, 0], [2, 1], [6, 1], [1, 0], [7, 0], [4, 2]];

const ENEMY_POOL = [
  { name: 'Helix Tither', icon: 'eye', job: 'rifleman', color: '#f87171' },
  { name: 'Rust Jackal', icon: 'bot', job: 'gunner', color: '#fb923c' },
  { name: 'Carbon Zealot', icon: 'shield', job: 'carbon-knight', color: '#f87171' },
  { name: 'Static Wraith', icon: 'ghost', job: 'flash-adept', color: '#22d3ee' },
  { name: 'Mesa Reaver', icon: 'skull', job: 'lancer', color: '#a78bfa' },
  { name: 'Pale Warden', icon: 'satellite', job: 'warden', color: '#e879f9' },
  { name: 'Scrap Hound', icon: 'dog', job: 'drifter', color: '#a8a29e' },
  { name: 'Dune Prophet', icon: 'moon', job: 'synthesist', color: '#4ade80' },
];
const ENEMY_PASSIVE: Record<string, string[]> = { 'carbon-knight': ['counter'], warden: ['guts'], lancer: ['phalanx'], gunner: ['quickdraw'] };
const WEAKS = ['ballistic', 'energy', 'blunt', 'pierce'];
const RANGED = ['Pistol', 'SMG', 'Assault', 'LongRifle', 'DEW'];

const fresh = { atkUp: 0, defUp: 0, defDown: 0, shield: 0, suit: 0, tempAtk: 0, steady: false, marked: 0, slow: 0, tauntUid: null, tauntTurns: 0, gutsUsed: false, acted: false, moved: false };

/** Resolve the character's six assignable slots into ability objects, usable in any job. */
function slottedAbilities(p: Character) {
  const learned = new Set(p.learned);
  const slots = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => p.skillSlots[i] ?? null);
  const abilities = slots
    .map(id => (id ? abilityById(id) : undefined))
    .filter((a): a is NonNullable<typeof a> => isSlottableAbility(a) && learned.has(a!.id));
  // Very old/partial data fallback: keep current-job learned skills available.
  if (abilities.length === 0) return jobById(p.jobId).abilities.filter(a => learned.has(a.id));
  return abilities;
}

export function createBattleUnits(party: Character[], node: WorldNode, storyIndex: number, battlesWon: number): BU[] {
  const rnd = mulberry(hashStr('units' + node.id + battlesWon));
  const list: BU[] = [];
  const deploy = party.slice(0, 5);

  deploy.forEach((p, i) => {
    const job = jobById(p.jobId);
    const s = baseStats(p);
    const passive = JOBS.flatMap(j => j.abilities)
      .filter(a => a.kind === 'passive' && p.learned.includes(a.id))
      .map(a => a.effect ?? '');
    const w = p.equip.weapon ? itemById(p.equip.weapon) : null;
    const wType = w?.weaponType ?? job.weapons[0];
    const range = WEAPON_INFO[wType].range;
    const bonus = passive.includes('uplink') && RANGED.includes(wType) ? 1 : 0;
    const [x, z] = PLAYER_SPAWNS[i];
    list.push({
      ...fresh, uid: 'p-' + p.id, charId: p.id, jobId: p.jobId, name: p.name, icon: p.icon, color: p.color, team: 'player',
      level: p.level, hp: Math.max(1, p.hp), maxHp: s.maxHp, atk: s.atk, def: s.def, spd: s.spd, mag: s.mag,
      move: s.move, jump: s.jump + (passive.includes('climb') ? 2 : 0), jobName: job.name,
      wType, wRange: [range[0], range[1] + bonus], wName: w?.name ?? wType, wAtk: w?.atk ?? 3,
      hasShield: !!p.equip.shield, passive, abilities: slottedAbilities(p),
      x, z, alive: true, weak: '—', scanned: true, flash: 2,
    });
  });

  const avg = deploy.reduce((a, p) => a + p.level, 0) / Math.max(1, deploy.length);
  const count = Math.min(6, 3 + Math.floor((storyIndex + 1) / 2) + (rnd() < 0.5 ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const t = ENEMY_POOL[Math.floor(rnd() * ENEMY_POOL.length)];
    const job = jobById(t.job);
    const lvl = Math.max(1, Math.round(Math.max(node.level, avg - 1) + (rnd() * 2 - 0.5)));
    const wType = job.weapons[0];
    const [x, z] = ENEMY_SPAWNS[i];
    list.push({
      ...fresh, uid: `e-${i}-${t.name}`, jobId: t.job, name: t.name + (count > 3 ? ' ' + (i + 1) : ''), icon: t.icon, color: t.color, team: 'enemy',
      level: lvl, hp: 30 + lvl * 9, maxHp: 30 + lvl * 9, atk: Math.round(5 + lvl * 1.4), def: Math.round(3 + lvl * 0.8),
      spd: Math.round(4 + lvl * 0.5 + rnd() * 2), mag: 4 + lvl, move: job.move, jump: job.jump, jobName: job.name,
      wType, wRange: WEAPON_INFO[wType].range, wName: wType, wAtk: Math.round(3 + lvl * 0.9),
      hasShield: false, passive: ENEMY_PASSIVE[t.job] ?? [], abilities: [],
      x, z, alive: true, weak: WEAKS[Math.floor(rnd() * WEAKS.length)], scanned: false, flash: 1,
    });
  }
  return list;
}
