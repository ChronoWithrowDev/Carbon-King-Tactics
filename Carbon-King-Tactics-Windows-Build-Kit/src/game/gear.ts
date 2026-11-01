import type { WeaponType } from './jobs';

export type Slot = 'weapon' | 'helmet' | 'armor' | 'shield' | 'accessory';

interface Item {
  id: string;
  name: string;
  slot: Slot;
  weaponType?: WeaponType;
  atk?: number;
  def?: number;
  mag?: number;
  spd?: number;
  hp?: number;
  price: number;
  desc: string;
}

export const SHOP: Item[] = [
  // Swords
  { id: 'w-rusty', name: 'Rusty Machete', slot: 'weapon', weaponType: 'Sword', atk: 4, price: 50, desc: 'Better than harsh language.' },
  { id: 'w-trench', name: 'Trench Sword', slot: 'weapon', weaponType: 'Sword', atk: 7, price: 220, desc: 'Pueblo steel, honest edge.' },
  { id: 'w-carbon', name: 'Carbon Saber', slot: 'weapon', weaponType: 'Sword', atk: 11, spd: 1, price: 650, desc: 'Woven carbon lattice blade.' },
  { id: 'w-milehigh', name: 'Mile High Brand', slot: 'weapon', weaponType: 'Sword', atk: 15, spd: 1, hp: 10, price: 1400, desc: 'Denver-forged officer blade.' },
  // Spears
  { id: 'w-pitch', name: 'Pitchfork', slot: 'weapon', weaponType: 'Spear', atk: 5, price: 80, desc: 'Farm implement. Do not ask.' },
  { id: 'w-pike', name: 'Compact Pike', slot: 'weapon', weaponType: 'Spear', atk: 9, price: 380, desc: 'Drill-team standard.' },
  { id: 'w-mesa', name: 'Mesa Lance', slot: 'weapon', weaponType: 'Spear', atk: 13, hp: 5, price: 900, desc: 'Mesa Verde ash shaft.' },
  // Maces
  { id: 'w-wrench', name: 'Wrench Mace', slot: 'weapon', weaponType: 'Mace', atk: 5, price: 70, desc: 'Pipe wrench. Universal key.' },
  { id: 'w-ballast', name: 'Ballast Maul', slot: 'weapon', weaponType: 'Mace', atk: 9, def: 1, price: 360, desc: 'Railroad ballast hammer.' },
  { id: 'w-seismic', name: 'Seismic Gavel', slot: 'weapon', weaponType: 'Mace', atk: 13, def: 2, price: 950, desc: 'Rings like a courtroom.' },
  // Pistols
  { id: 'w-snub', name: 'Snub Halo', slot: 'weapon', weaponType: 'Pistol', atk: 5, price: 120, desc: 'Fits in a boot, ends arguments.' },
  { id: 'w-peacemaker', name: 'Purgatoire Peacemaker', slot: 'weapon', weaponType: 'Pistol', atk: 8, spd: 1, price: 420, desc: 'Trinidad gunsmith special.' },
  { id: 'w-judge', name: 'Circuit Judge', slot: 'weapon', weaponType: 'Pistol', atk: 12, price: 1000, desc: 'Smart-linked sidearm.' },
  // SMG
  { id: 'w-grease', name: 'Grease Hose', slot: 'weapon', weaponType: 'SMG', atk: 7, price: 380, desc: 'Sprays like gossip.' },
  { id: 'w-coyote', name: 'Coyote Howl', slot: 'weapon', weaponType: 'SMG', atk: 11, spd: 1, price: 950, desc: 'Pueblo-made bullet hose.' },
  // Assault
  { id: 'w-varmint', name: 'Varmint AR', slot: 'weapon', weaponType: 'Assault', atk: 8, price: 450, desc: 'Ranch rifle, tuned up.' },
  { id: 'w-compact', name: 'Compact Standard AR', slot: 'weapon', weaponType: 'Assault', atk: 12, price: 1050, desc: 'Front Range militia issue.' },
  { id: 'w-bison', name: 'Bison Drum AR', slot: 'weapon', weaponType: 'Assault', atk: 15, hp: 8, price: 1700, desc: '60-round hymn.' },
  // LongRifle
  { id: 'w-squirrel', name: 'Squirrel Rifle', slot: 'weapon', weaponType: 'LongRifle', atk: 10, price: 500, desc: 'Long, patient, judgmental.' },
  { id: 'w-elk', name: 'Elk Thumper', slot: 'weapon', weaponType: 'LongRifle', atk: 15, price: 1300, desc: 'Drops elk. And other things.' },
  { id: 'w-powder', name: 'Champagne Powder', slot: 'weapon', weaponType: 'LongRifle', atk: 19, spd: 1, price: 2200, desc: 'Steamboat custom. Worth it.' },
  // DEW
  { id: 'w-spark', name: 'Spark Gap', slot: 'weapon', weaponType: 'DEW', atk: 7, mag: 3, price: 550, desc: 'Smells like thunderstorm.' },
  { id: 'w-arc', name: 'Arc Caster', slot: 'weapon', weaponType: 'DEW', atk: 11, mag: 5, price: 1250, desc: 'Boulder fab prototype.' },
  { id: 'w-helios', name: 'Helios Lance', slot: 'weapon', weaponType: 'DEW', atk: 16, mag: 8, price: 2400, desc: 'Pikes Peak array surplus. Probably stolen.' },
  // Helmets
  { id: 'h-cap', name: 'Trucker Cap', slot: 'helmet', def: 1, price: 40, desc: 'Mesh back. Zero protection, full confidence.' },
  { id: 'h-halo', name: 'Halo Headband', slot: 'helmet', def: 2, mag: 2, price: 250, desc: 'Non-invasive BCI weave.' },
  { id: 'h-ballistic', name: 'Ballistic Lid', slot: 'helmet', def: 4, hp: 8, price: 600, desc: 'Fort Carson surplus.' },
  { id: 'h-crownmesh', name: 'Crown Mesh', slot: 'helmet', def: 5, mag: 4, price: 1200, desc: 'Warden-grade lattice.' },
  // Armor
  { id: 'a-flannel', name: 'Flannel + Denim', slot: 'armor', def: 2, hp: 5, price: 60, desc: 'Colorado formal wear.' },
  { id: 'a-vest', name: 'Plate Vest', slot: 'armor', def: 5, hp: 12, price: 400, desc: 'Stops most bad decisions.' },
  { id: 'a-weave', name: 'Carbon Weave', slot: 'armor', def: 7, spd: 1, hp: 15, price: 950, desc: 'Light, strong, smug.' },
  { id: 'a-hull', name: 'Hull Plate', slot: 'armor', def: 10, hp: 25, spd: -1, price: 1800, desc: 'Wearable front door.' },
  // Shields
  { id: 's-lid', name: 'Trash Lid', slot: 'shield', def: 2, price: 50, desc: 'It has dents with stories.' },
  { id: 's-riot', name: 'Riot Shield', slot: 'shield', def: 4, hp: 8, price: 350, desc: 'Denver PD surplus. Oops.' },
  { id: 's-aegis', name: 'Aegis Panel', slot: 'shield', def: 6, mag: 2, hp: 10, price: 900, desc: 'Projects a flash hex.' },
  // Accessories
  { id: 'x-coffee', name: 'Bottomless Coffee', slot: 'accessory', spd: 2, price: 300, desc: '+2 Spd. Salida roast.' },
  { id: 'x-lucky', name: "Gambler's Chip", slot: 'accessory', atk: 2, mag: 2, price: 450, desc: 'Cripple Creek souvenir. Still warm.' },
  { id: 'x-battery', name: 'Hot Battery', slot: 'accessory', mag: 4, price: 700, desc: 'Longer flash cycles.' },
  { id: 'x-boots', name: 'Mesa Boots', slot: 'accessory', spd: 1, hp: 10, def: 1, price: 650, desc: 'For jumping mesas.' },
  { id: 'x-crown', name: 'Static Locket', slot: 'accessory', atk: 3, def: 2, mag: 3, price: 1500, desc: 'Hums your name when you\'re alone.' },
];

export function itemById(id: string): Item {
  return SHOP.find(i => i.id === id)!;
}
