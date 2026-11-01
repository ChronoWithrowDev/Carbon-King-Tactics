export type WeaponType = 'Sword' | 'Spear' | 'Mace' | 'Pistol' | 'SMG' | 'Assault' | 'LongRifle' | 'DEW';

export interface JobAbility {
  id: string;
  name: string;
  desc: string;
  jpCost: number;
  kind: 'active' | 'passive' | 'flash';
  power: number; // multiplier or flat
  range: number;
  aoe: number; // radius
  flash?: boolean;
  effect?: string;
  targetType: 'enemy' | 'ally' | 'self' | 'tile';
}

export interface Job {
  id: string;
  name: string;
  icon: string;
  desc: string;
  flavor: string;
  weapons: WeaponType[];
  canShield: boolean;
  growth: { hp: number; atk: number; def: number; spd: number; mag: number };
  move: number;
  jump: number;
  masteryBonus: string;
  masteryStat: Partial<Record<'hp' | 'atk' | 'def' | 'spd' | 'mag', number>>;
  abilities: JobAbility[];
  unique?: boolean;
  color: string;
}

export const WEAPON_INFO: Record<WeaponType, { range: [number, number]; desc: string }> = {
  Sword: { range: [1, 1], desc: 'Balanced blades. Can equip Shield.' },
  Spear: { range: [1, 2], desc: 'Long reach, pierces lines. 2-handed.' },
  Mace: { range: [1, 1], desc: 'Crush armor. Bonus vs robots. Can equip Shield.' },
  Pistol: { range: [1, 4], desc: 'One-handed sidearm. Reliable. No shield (ranged).' },
  SMG: { range: [1, 3], desc: 'Bullet hose. 3-round burst. 2-handed.' },
  Assault: { range: [2, 5], desc: 'Assault rifle. Versatile mid-range.' },
  LongRifle: { range: [3, 7], desc: 'Snipers. Huge range, needs height.' },
  DEW: { range: [1, 4], desc: 'Directed energy. Melts armor. Uses charge.' },
};

/** Shields only pair with one-handed, non-ranged weapons (sword, mace). */
export const SHIELD_OK: Record<string, boolean> = { Sword: true, Mace: true };

export const JOBS: Job[] = [
  {
    id: 'drifter', name: 'Drifter', icon: 'compass', color: '#a8a29e',
    desc: 'Scrappy all-rounder. Every legend starts hitchhiking.',
    flavor: 'FFT Squire analogue. Cheap to master, solid everywhere.',
    weapons: ['Sword', 'Mace', 'Pistol'], canShield: true,
    growth: { hp: 12, atk: 3, def: 2, spd: 3, mag: 2 }, move: 4, jump: 3,
    masteryBonus: '+10 HP, +1 Move carryover', masteryStat: { hp: 10, spd: 1 },
    abilities: [
      { id: 'd-focus', name: 'Focus', desc: '+30% Atk for 2 turns (self).', jpCost: 100, kind: 'active', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'atkUp' },
      { id: 'd-rush', name: 'Dash Slash', desc: '1.2x dash strike, range 2.', jpCost: 200, kind: 'active', power: 1.2, range: 2, aoe: 0, targetType: 'enemy' },
      { id: 'd-salve', name: 'Road Salve', desc: 'Heal ally 40 + mag.', jpCost: 250, kind: 'active', power: 40, range: 3, aoe: 0, targetType: 'ally', effect: 'heal' },
      { id: 'd-scavenge', name: 'Scavenge', desc: 'Passive: +25% gold after battle.', jpCost: 300, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'goldUp' },
      { id: 'd-yell', name: "Hitchhiker's Yell", desc: 'All allies +1 Move 1 turn.', jpCost: 450, kind: 'active', power: 0, range: 4, aoe: 2, targetType: 'ally', effect: 'haste' },
    ],
  },
  {
    id: 'carbon-knight', name: 'Carbon Knight', icon: 'shield', color: '#60a5fa',
    desc: 'Front-line tank. Swords, maces, shields.',
    flavor: 'Knight analogue. Holds the line at the Gorge.',
    weapons: ['Sword', 'Mace'], canShield: true,
    growth: { hp: 18, atk: 4, def: 5, spd: 1, mag: 1 }, move: 3, jump: 2,
    masteryBonus: '+20 HP, +2 Def carryover', masteryStat: { hp: 20, def: 2 },
    abilities: [
      { id: 'ck-guard', name: 'Aegis Guard', desc: 'Self +50% Def 2 turns.', jpCost: 150, kind: 'active', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'defUp' },
      { id: 'ck-break', name: 'Shield Break', desc: '1.3x + shred Def.', jpCost: 300, kind: 'active', power: 1.3, range: 1, aoe: 0, targetType: 'enemy', effect: 'defDown' },
      { id: 'ck-taunt', name: 'Carbon Taunt', desc: 'Force adjacent foes to target you.', jpCost: 350, kind: 'active', power: 0, range: 2, aoe: 1, targetType: 'enemy', effect: 'taunt' },
      { id: 'ck-counter', name: 'Riposte Core', desc: 'Passive: 50% counter 0.7x.', jpCost: 500, kind: 'passive', power: 0.7, range: 0, aoe: 0, targetType: 'self', effect: 'counter' },
      { id: 'ck-laststand', name: 'Last Stand', desc: 'Survive lethal at 1 HP once/battle (passive).', jpCost: 700, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'guts' },
    ],
  },
  {
    id: 'lancer', name: 'Pike Lancer', icon: 'sword', color: '#34d399',
    desc: 'Spear wall. Strikes over allies, leaps mesas.',
    flavor: 'Dragoon-ish. King of Royal Gorge bridge.',
    weapons: ['Spear'], canShield: false,
    growth: { hp: 14, atk: 5, def: 3, spd: 2, mag: 1 }, move: 4, jump: 4,
    masteryBonus: '+3 Atk, +1 Jump carryover', masteryStat: { atk: 3 },
    abilities: [
      { id: 'l-poke', name: 'Long Poke', desc: '1.1x at range 2, ignores cover.', jpCost: 150, kind: 'active', power: 1.1, range: 2, aoe: 0, targetType: 'enemy' },
      { id: 'l-skewer', name: 'Skewer Line', desc: '1.0x line through 3 tiles.', jpCost: 350, kind: 'active', power: 1.0, range: 3, aoe: 0, targetType: 'enemy', effect: 'line' },
      { id: 'l-drop', name: 'Mesa Drop', desc: '2.0x leap, +dmg from height. Jump 5.', jpCost: 550, kind: 'active', power: 2.0, range: 4, aoe: 1, targetType: 'enemy', effect: 'leap' },
      { id: 'l-phalanx', name: 'Phalanx', desc: 'Passive: +1 Def per adjacent ally.', jpCost: 400, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'phalanx' },
    ],
  },
  {
    id: 'gunner', name: 'Gunner', icon: 'crosshair', color: '#fbbf24',
    desc: 'Pistols & SMGs. Close-quarters storm.',
    flavor: 'Pistoleros of Pueblo. Burst fire royalty.',
    weapons: ['Pistol', 'SMG'], canShield: false,
    growth: { hp: 11, atk: 4, def: 2, spd: 4, mag: 1 }, move: 4, jump: 3,
    masteryBonus: '+2 Spd, +2 Atk carryover', masteryStat: { spd: 2, atk: 2 },
    abilities: [
      { id: 'g-double', name: 'Double Tap', desc: '2 hits x0.7, range 4.', jpCost: 200, kind: 'active', power: 0.7, range: 4, aoe: 0, targetType: 'enemy', effect: 'double' },
      { id: 'g-suppress', name: 'Suppressing Burst', desc: '0.8x + slow enemy (SMG).', jpCost: 350, kind: 'active', power: 0.8, range: 3, aoe: 1, targetType: 'enemy', effect: 'slow' },
      { id: 'g-fan', name: 'Fan the Hammer', desc: 'Hits all adjacent enemies 0.9x.', jpCost: 400, kind: 'active', power: 0.9, range: 1, aoe: 1, targetType: 'enemy' },
      { id: 'g-quickdraw', name: 'Quickdraw', desc: 'Passive: +20% first-round damage.', jpCost: 450, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'quickdraw' },
    ],
  },
  {
    id: 'rifleman', name: 'Rifleman', icon: 'target', color: '#f97316',
    desc: 'Assault rifles. Mid-range anchor.',
    flavor: 'The Compact standard. Reliable as sunrise over Limon.',
    weapons: ['Assault', 'Pistol'], canShield: false,
    growth: { hp: 12, atk: 5, def: 2, spd: 3, mag: 1 }, move: 4, jump: 2,
    masteryBonus: '+3 Atk carryover', masteryStat: { atk: 3 },
    abilities: [
      { id: 'r-burst', name: 'Controlled Burst', desc: '1.4x, range 2-5.', jpCost: 200, kind: 'active', power: 1.4, range: 5, aoe: 0, targetType: 'enemy' },
      { id: 'r-grenade', name: 'Beanbag Grenade', desc: '0.9x AoE + slow.', jpCost: 400, kind: 'active', power: 0.9, range: 4, aoe: 1, targetType: 'enemy', effect: 'slow' },
      { id: 'r-overwatch', name: 'Overwatch', desc: 'Passive: shoot enemies that act in range.', jpCost: 600, kind: 'passive', power: 0.8, range: 0, aoe: 0, targetType: 'self', effect: 'overwatch' },
      { id: 'r-rally', name: 'Rally Point', desc: 'Allies in 2 tiles +20% Atk.', jpCost: 350, kind: 'active', power: 0, range: 2, aoe: 2, targetType: 'ally', effect: 'atkUp' },
    ],
  },
  {
    id: 'deadeye', name: 'Deadeye', icon: 'telescope', color: '#a78bfa',
    desc: 'Long rifles. Deletes problems from 7 tiles.',
    flavor: 'Leadville spotters. Elevation is ammunition.',
    weapons: ['LongRifle'], canShield: false,
    growth: { hp: 10, atk: 6, def: 1, spd: 3, mag: 1 }, move: 3, jump: 2,
    masteryBonus: '+4 Atk carryover', masteryStat: { atk: 4 },
    abilities: [
      { id: 'de-steady', name: 'Steady Breath', desc: 'Self +50% dmg next shot.', jpCost: 150, kind: 'active', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'steady' },
      { id: 'de-headshot', name: 'Headshot', desc: '2.2x, range 3-7, bonus from height.', jpCost: 500, kind: 'active', power: 2.2, range: 7, aoe: 0, targetType: 'enemy' },
      { id: 'de-spot', name: "Spotter's Mark", desc: 'Mark: marked foe takes +30% (team).', jpCost: 300, kind: 'active', power: 0, range: 7, aoe: 0, targetType: 'enemy', effect: 'mark' },
      { id: 'de-climb', name: 'Alpine Legs', desc: 'Passive: +2 Jump.', jpCost: 400, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'climb' },
    ],
  },
  {
    id: 'flash-adept', name: 'Flash Adept', icon: 'zap', color: '#22d3ee',
    desc: 'DEW + Flash Inference. Tokens made manifest.',
    flavor: 'The weird ones. You can hear their halos thinking.',
    weapons: ['DEW', 'Mace'], canShield: false,
    growth: { hp: 10, atk: 2, def: 2, spd: 3, mag: 6 }, move: 4, jump: 3,
    masteryBonus: '+4 Mag carryover', masteryStat: { mag: 4 },
    abilities: [
      { id: 'f-scan', name: 'FLASH: Deep Scan', desc: '[FLASH] Reveal HP + weakness of all foes in 5.', jpCost: 150, kind: 'flash', power: 0, range: 5, aoe: 5, flash: true, targetType: 'enemy', effect: 'scan' },
      { id: 'f-lance', name: 'FLASH: Arc Lance', desc: '[FLASH] 1.6x energy bolt, range 4.', jpCost: 300, kind: 'flash', power: 1.6, range: 4, aoe: 0, flash: true, targetType: 'enemy' },
      { id: 'f-blade', name: 'FLASH: Synth Blade', desc: '[FLASH] Synthesize temp +8 sword for 3 turns.', jpCost: 400, kind: 'flash', power: 8, range: 0, aoe: 0, flash: true, targetType: 'self', effect: 'synthWeapon' },
      { id: 'f-shell', name: 'FLASH: Aegis Shell', desc: '[FLASH] Ally shield absorbs 60.', jpCost: 450, kind: 'flash', power: 60, range: 4, aoe: 0, flash: true, targetType: 'ally', effect: 'shield' },
      { id: 'f-suit', name: 'FLASH: Hull Suit', desc: '[FLASH] Robot suit: +shield +Def 3 turns.', jpCost: 800, kind: 'flash', power: 0, range: 0, aoe: 0, flash: true, targetType: 'self', effect: 'suit' },
    ],
  },
  {
    id: 'synthesist', name: 'Synthesist', icon: 'dna', color: '#4ade80',
    desc: 'Atomic synthesis. Builds cover, blades, buddies.',
    flavor: 'Dunes-trained. "Everything is feedstock."',
    weapons: ['Mace', 'Pistol', 'DEW'], canShield: true,
    growth: { hp: 11, atk: 2, def: 3, spd: 2, mag: 5 }, move: 4, jump: 3,
    masteryBonus: '+3 Mag, +10 HP carryover', masteryStat: { mag: 3, hp: 10 },
    abilities: [
      { id: 's-mend', name: 'Mend Lattice', desc: 'Heal 55 + mag scaling, range 4.', jpCost: 200, kind: 'active', power: 55, range: 4, aoe: 0, targetType: 'ally', effect: 'heal' },
      { id: 's-wall', name: 'FLASH: Raise Wall', desc: '[FLASH] Synthesize a blocking cover wall on a tile.', jpCost: 350, kind: 'flash', power: 0, range: 4, aoe: 0, flash: true, targetType: 'tile', effect: 'wall' },
      { id: 's-mote', name: 'FLASH: Conjure Mote', desc: '[FLASH] Temporary synth companion fights 3 turns.', jpCost: 600, kind: 'flash', power: 0, range: 3, aoe: 0, flash: true, targetType: 'tile', effect: 'summon' },
      { id: 's-purge', name: 'Purge Static', desc: 'Cleanse debuffs + heal 25.', jpCost: 300, kind: 'active', power: 25, range: 4, aoe: 1, targetType: 'ally', effect: 'cleanse' },
    ],
  },
  {
    id: 'surgeon', name: 'Field Surgeon', icon: 'heartpulse', color: '#f472b6',
    desc: 'Combat medic. Keeps carbon nodes online.',
    flavor: 'Salida river guides turned medics. Calm hands.',
    weapons: ['Pistol', 'Mace'], canShield: true,
    growth: { hp: 12, atk: 2, def: 3, spd: 3, mag: 4 }, move: 4, jump: 3,
    masteryBonus: '+15 HP, +2 Mag carryover', masteryStat: { hp: 15, mag: 2 },
    abilities: [
      { id: 'm-triage', name: 'Triage', desc: 'Heal 70, range 4.', jpCost: 200, kind: 'active', power: 70, range: 4, aoe: 0, targetType: 'ally', effect: 'heal' },
      { id: 'm-revive', name: 'Cold Restart', desc: 'Revive a downed ally at 50% HP.', jpCost: 500, kind: 'active', power: 0, range: 3, aoe: 0, targetType: 'ally', effect: 'revive' },
      { id: 'm-stim', name: 'Stim Slap', desc: 'Ally +Atk buff + heal 20.', jpCost: 350, kind: 'active', power: 20, range: 3, aoe: 0, targetType: 'ally', effect: 'stim' },
      { id: 'm-tough', name: 'Trauma Training', desc: 'Passive: healing +30%.', jpCost: 450, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'healUp' },
    ],
  },
  {
    id: 'warden', name: 'Lattice Warden', icon: 'radio', color: '#e879f9',
    desc: 'Support artillery spotter. Calls the sky.',
    flavor: 'Unlocks after capturing a Base. The sky is just another weapon.',
    weapons: ['Assault', 'SMG', 'Sword'], canShield: false,
    growth: { hp: 13, atk: 4, def: 3, spd: 3, mag: 3 }, move: 4, jump: 3,
    masteryBonus: '+2 Atk, +2 Mag carryover', masteryStat: { atk: 2, mag: 2 },
    abilities: [
      { id: 'w-designate', name: 'Designate', desc: 'Laser mark: marked foe takes +30%.', jpCost: 200, kind: 'active', power: 0, range: 6, aoe: 0, targetType: 'enemy', effect: 'mark' },
      { id: 'w-barrage', name: 'CALL: Artillery', desc: 'Requires captured Base. 2.0x AoE r=2.', jpCost: 500, kind: 'active', power: 2.0, range: 9, aoe: 2, targetType: 'enemy', effect: 'artillery' },
      { id: 'w-airstrike', name: 'CALL: Airstrike', desc: 'Requires DIA. 2.6x AoE.', jpCost: 800, kind: 'active', power: 2.6, range: 9, aoe: 1, targetType: 'enemy', effect: 'airstrike' },
      { id: 'w-uplink', name: 'Uplink', desc: 'Passive: +1 range to all guns.', jpCost: 450, kind: 'passive', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'uplink' },
    ],
  },
  // Unique jobs
  {
    id: 'carbon-king', name: 'Carbon King', icon: 'crown', color: '#facc15', unique: true,
    desc: "RYE ONLY. The node that outgrew the network.",
    flavor: 'Grows with story. Ends the world. Starts a better one.',
    weapons: ['Sword', 'Pistol', 'DEW', 'Assault'], canShield: true,
    growth: { hp: 16, atk: 5, def: 4, spd: 4, mag: 5 }, move: 5, jump: 4,
    masteryBonus: 'Cannot be mastered — it masters you.', masteryStat: {},
    abilities: [
      { id: 'ck2-edict', name: "Sovereign's Edict", desc: 'Allies in 5: +Atk buff 2 turns.', jpCost: 0, kind: 'active', power: 0, range: 5, aoe: 5, targetType: 'ally', effect: 'atkUp' },
      { id: 'ck2-verdict', name: 'FLASH: Verdict', desc: '[FLASH] 2.0x to enemies in radius 2.', jpCost: 0, kind: 'flash', power: 2.0, range: 6, aoe: 2, flash: true, targetType: 'enemy' },
      { id: 'ck2-crown', name: 'FLASH: Crown of Static', desc: '[FLASH] Ally gains Hull Suit.', jpCost: 0, kind: 'flash', power: 0, range: 4, aoe: 0, flash: true, targetType: 'ally', effect: 'suit' },
    ],
  },
  {
    id: 'ghost-signal', name: 'Ghost Signal', icon: 'ghost', color: '#93c5fd', unique: true,
    desc: 'MAYA ONLY. Ex-NORAD ghost in the machine.',
    flavor: 'Hacks turns themselves.',
    weapons: ['SMG', 'LongRifle', 'DEW'], canShield: false,
    growth: { hp: 11, atk: 4, def: 2, spd: 5, mag: 5 }, move: 5, jump: 3,
    masteryBonus: 'Unique.', masteryStat: {},
    abilities: [
      { id: 'gs-skip', name: 'FLASH: Skip Trace', desc: '[FLASH] Teleport up to 5 tiles.', jpCost: 0, kind: 'flash', power: 0, range: 5, aoe: 0, flash: true, targetType: 'tile', effect: 'teleport' },
      { id: 'gs-loop', name: 'Time Loop', desc: 'Act again immediately (once per use).', jpCost: 0, kind: 'active', power: 0, range: 0, aoe: 0, targetType: 'self', effect: 'extraTurn' },
      { id: 'gs-jam', name: 'Jam Field', desc: 'Foes in radius 2 are slowed.', jpCost: 0, kind: 'active', power: 0, range: 4, aoe: 2, targetType: 'enemy', effect: 'slow' },
    ],
  },
  {
    id: 'echo-vessel', name: 'Echo Vessel', icon: 'orbit', color: '#5eead4', unique: true,
    desc: 'ECHO-7 ONLY. A digital person wearing borrowed carbon.',
    flavor: 'Low-power always-on. Flash at will.',
    weapons: ['Mace', 'DEW', 'Spear'], canShield: true,
    growth: { hp: 13, atk: 3, def: 4, spd: 3, mag: 6 }, move: 4, jump: 4,
    masteryBonus: 'Unique.', masteryStat: {},
    abilities: [
      { id: 'ev-flashheal', name: 'FLASH: Always-On Mend', desc: '[FLASH] Heal all allies in 5 for 35.', jpCost: 0, kind: 'flash', power: 35, range: 5, aoe: 5, flash: true, targetType: 'ally', effect: 'heal' },
      { id: 'ev-fork', name: 'FLASH: Fork Self', desc: '[FLASH] Conjure an Echo copy for 3 turns.', jpCost: 0, kind: 'flash', power: 0, range: 2, aoe: 0, flash: true, targetType: 'tile', effect: 'summon' },
      { id: 'ev-overclock', name: 'FLASH: Overclock', desc: '[FLASH] Self +Atk/+Spd surge 3 turns.', jpCost: 0, kind: 'flash', power: 0, range: 0, aoe: 0, flash: true, targetType: 'self', effect: 'haste' },
    ],
  },
];

export function jobById(id: string): Job {
  return JOBS.find(j => j.id === id)!;
}

export function jobCostTotal(id: string): number {
  return jobById(id).abilities.reduce((a, b) => a + b.jpCost, 0);
}

/** Each character has this many assignable active/flash skill slots, usable across jobs. */
export const SKILL_SLOT_COUNT = 6;

export function abilityById(id: string): JobAbility | undefined {
  for (const job of JOBS) {
    const found = job.abilities.find(a => a.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Passives stay learned forever; active and flash abilities occupy the six skill slots. */
export function isSlottableAbility(a: JobAbility | undefined): a is JobAbility {
  return !!a && a.kind !== 'passive';
}
