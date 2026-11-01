import type { WorldNode } from './world';
import { mulberry, hashStr } from '../lib/rng';

export const SIZE = 9;

export type TexKind = 'grass' | 'dirt' | 'rock' | 'concrete' | 'snow' | 'sand' | 'asphalt';
type PropKind = 'pine' | 'snowpine' | 'rock' | 'redrock' | 'cactus' | 'crate' | 'barrel' | 'fence' | 'rack' | 'antenna' | 'tent' | 'turbine' | 'ruin' | 'lamp';
export type ObstacleKind = 'building' | 'tower' | 'wall' | 'rackbank' | 'chalet' | 'mill';
type Skyline = 'peaks' | 'buttes' | 'city';
type Profile = 'flat' | 'rolling' | 'peaks' | 'gorge' | 'dunes' | 'urban' | 'mesa';

export interface Theme {
  key: string;
  label: string;
  skyTop: number; skyMid: number; skyHorizon: number; sun: number;
  fog: number; fogDensity: number;
  ground: number;
  /** tile top color per height 0..3 */
  palette: [number, number, number, number];
  patch: number;   // occasional dirt/path patches so the map never reads as one flat color
  side: number;    // cliff/side color
  tex: TexKind;
  props: PropKind[]; propCount: number;
  obstacle: ObstacleKind | null; obstacleCount: number;
  profile: Profile;
  water: boolean; road: boolean; skyline: Skyline; snowCaps: boolean;
}

export interface BattleMap {
  heights: number[][];
  blocked: boolean[][];
  water: boolean[][];
  city: boolean[][];   // obstacle tiles (buildings, walls, rack banks…)
  road: boolean[][];
  theme: Theme;
}

/* ------------------------------ theme palettes ------------------------------ */

const BASE: Theme = {
  key: 'foothills', label: 'Foothills',
  skyTop: 0x2a3a6a, skyMid: 0x8a7aa8, skyHorizon: 0xf4c07a, sun: 0xffc878, fog: 0xcdb48c, fogDensity: 0.016,
  ground: 0x4e6a44, palette: [0x5a8449, 0x689052, 0x75855c, 0x8b8f96], patch: 0x7a6a48, side: 0x6a5a48, tex: 'grass',
  props: ['pine', 'pine', 'rock'], propCount: 9, obstacle: null, obstacleCount: 0,
  profile: 'rolling', water: false, road: false, skyline: 'peaks', snowCaps: false,
};
const T = (o: Partial<Theme>): Theme => ({ ...BASE, ...o });

const SKY_SNOW = { skyTop: 0x3f78b8, skyMid: 0x9cc4e4, skyHorizon: 0xeaf3fb, sun: 0xfff1d0, fog: 0xcfe0ee, fogDensity: 0.014 };
const SKY_RED = { skyTop: 0x3a3466, skyMid: 0xb0607a, skyHorizon: 0xffa862, sun: 0xffb66e, fog: 0xd9a27c };
const SKY_CITY = { skyTop: 0x1a2146, skyMid: 0x5b4a86, skyHorizon: 0xff8f6e, sun: 0xff9a7a, fog: 0xb5909a };
const SKY_CLEAN = { skyTop: 0x2c6197, skyMid: 0x83b6cc, skyHorizon: 0xf4e0a8, sun: 0xffe6a0, fog: 0xcfdcd0 };

const V = {
  prairie: T({ key: 'prairie', label: 'Prairie Dusk', palette: [0x9a9a58, 0xa6a460, 0xb2aa6c, 0xaaa090], patch: 0xc2a868, side: 0x8a7456, ground: 0x8a8a50, props: ['rock', 'crate', 'fence', 'antenna', 'tent'], propCount: 7, profile: 'flat', obstacle: 'building', obstacleCount: 3 }),
  highway: T({ key: 'highway', label: 'Highway Strip', palette: [0x8c9096, 0x979b9f, 0x7f858c, 0x6e747c], patch: 0x6a7078, side: 0x5a6068, tex: 'concrete', ground: 0x5a6050, props: ['lamp', 'crate', 'barrel', 'fence'], propCount: 8, profile: 'flat', road: true, obstacle: 'building', obstacleCount: 4 }),
  mill: T({ key: 'mill', label: 'Steel Mill', skyHorizon: 0xe8a46a, fog: 0xc9a088, palette: [0x7f7a74, 0x8a847c, 0x746f6c, 0x66625f], patch: 0x8a5a40, side: 0x4e4a48, tex: 'concrete', ground: 0x5a5048, props: ['crate', 'barrel', 'fence', 'lamp'], propCount: 8, profile: 'urban', obstacle: 'mill', obstacleCount: 4, skyline: 'city' }),
  fortress: T({ key: 'fortress', label: 'Mountain Fortress', palette: [0x8d98a6, 0x98a2ae, 0x7f8a98, 0x6d7886], patch: 0x6a7480, side: 0x586270, tex: 'concrete', ground: 0x4a5260, props: ['antenna', 'lamp', 'crate', 'barrel'], propCount: 6, profile: 'urban', obstacle: 'wall', obstacleCount: 6 }),
  redrock: T({ ...SKY_RED, key: 'redrock', label: 'Red Rock Country', palette: [0xb06a44, 0xc27a4e, 0xa66248, 0x8a523e], patch: 0xd8a56a, side: 0x8a4a36, tex: 'dirt', ground: 0x8a4f36, props: ['redrock', 'redrock', 'cactus', 'rock', 'ruin'], propCount: 10, skyline: 'buttes' }),
  mesa: T({ ...SKY_RED, key: 'mesa', label: 'Mesa Country', palette: [0xc08a58, 0xcf9a62, 0xb27858, 0x9a6448], patch: 0xe0b878, side: 0x95563c, tex: 'dirt', ground: 0x8a5a3c, props: ['cactus', 'rock', 'redrock', 'cactus'], propCount: 8, profile: 'mesa', skyline: 'buttes' }),
  snow: T({ ...SKY_SNOW, key: 'snow', label: 'Summit Snowfield', palette: [0xdfe9f3, 0xe8f0f8, 0xc9d3de, 0xaab5c2], patch: 0xb9c6d6, side: 0x78828f, tex: 'snow', ground: 0xc7d2de, props: ['snowpine', 'rock', 'snowpine'], propCount: 9, profile: 'peaks', snowCaps: true }),
  alpine: T({ ...SKY_SNOW, key: 'alpine', label: 'Alpine High Country', palette: [0x557d4e, 0x6b7f5e, 0x8b8f96, 0xedf3fa], patch: 0x8a9a70, side: 0x6a6a70, props: ['snowpine', 'snowpine', 'rock'], propCount: 12, profile: 'peaks', snowCaps: true }),
  rooftops: T({ ...SKY_CITY, key: 'rooftops', label: 'Downtown Rooftops', palette: [0x7b838c, 0x868e97, 0x6e7680, 0x5f6772], patch: 0x5a626c, side: 0x464e5a, tex: 'concrete', ground: 0x3a404a, props: ['antenna', 'lamp', 'crate'], propCount: 6, profile: 'urban', obstacle: 'tower', obstacleCount: 9, skyline: 'city' }),
  city: T({ ...SKY_CITY, key: 'city', label: 'City Streets', palette: [0x8f979e, 0x9aa1a6, 0x7b8489, 0x6b7280], patch: 0x6a7078, side: 0x4e5660, tex: 'concrete', ground: 0x4a5258, props: ['lamp', 'antenna', 'crate', 'barrel'], propCount: 7, profile: 'urban', obstacle: 'building', obstacleCount: 6, skyline: 'city' }),
  campus: T({ ...SKY_CLEAN, key: 'campus', label: 'Campus Green', palette: [0x6aa04e, 0x76ac56, 0x82a860, 0x8b9a78], patch: 0xc2b28a, side: 0x7a5f48, props: ['pine', 'lamp', 'fence', 'rock'], propCount: 8, obstacle: 'building', obstacleCount: 5 }),
  lab: T({ ...SKY_CLEAN, key: 'lab', label: 'Research Campus', palette: [0xa8b8c0, 0xb4c4cc, 0x98aab4, 0x8696a2], patch: 0x7fa0a8, side: 0x5a6a74, tex: 'concrete', ground: 0x56646a, props: ['rack', 'antenna', 'crate', 'lamp'], propCount: 7, profile: 'urban', obstacle: 'rackbank', obstacleCount: 5 }),
  chalet: T({ ...SKY_SNOW, key: 'chalet', label: 'Alpine Chalets', palette: [0xe4ecf4, 0xd2dfe9, 0x9aac98, 0x8b9a8a], patch: 0x6e8a64, side: 0x6b5846, tex: 'snow', ground: 0xaab8c4, props: ['snowpine', 'snowpine', 'fence', 'rock'], propCount: 9, obstacle: 'chalet', obstacleCount: 4, snowCaps: true }),
  gorge: T({ ...SKY_RED, key: 'gorge', label: 'Canyon Gorge', palette: [0x6a5a56, 0x7a6a62, 0x8a7a70, 0x9a8a80], patch: 0x5a4a46, side: 0x4a3c3a, tex: 'rock', ground: 0x3a3030, props: ['rock', 'rock', 'pine'], propCount: 8, profile: 'gorge', skyline: 'buttes' }),
  dunes: T({ key: 'dunes', label: 'Singing Dunes', skyTop: 0x3a4a7a, skyMid: 0xc4a07a, skyHorizon: 0xffd89a, sun: 0xffe0a0, fog: 0xe8cfa0, palette: [0xdfc084, 0xe6c98e, 0xeed49a, 0xf4e0aa], patch: 0xc9a05e, side: 0xb8935a, tex: 'sand', ground: 0xc9a05e, props: ['rock', 'cactus'], propCount: 5, profile: 'dunes', skyline: 'buttes' }),
  plains: T({ key: 'plains', label: 'High Plains', palette: [0x93a25a, 0x9dab62, 0xa8b06a, 0xb0b576], patch: 0xc2b070, side: 0x8a7a52, ground: 0x8a9a52, props: ['turbine', 'tent', 'rock', 'fence'], propCount: 7, profile: 'flat' }),
  foothilltown: T({ key: 'foothilltown', label: 'Foothills Town', props: ['pine', 'crate', 'tent', 'rock', 'fence'], propCount: 8, obstacle: 'building', obstacleCount: 3 }),
  foothills: BASE,
};

const SNOW = new Set(['estes-park', 'monarch-pass', 'eisenhower', 'breck', 'vail', 'leadville', 'winter-park', 'steamboat', 'wolf-creek', 'georgetown', 'dillon', 'ouray', 'telluride', 'lake-city', 'creede', 'la-veta-pass', 'nederland', 'lyons', 'spanish-peaks', 'fishers-peak']);
const RED = new Set(['red-rocks', 'fruita', 'palisade', 'rifle', 'montrose', 'cortez', 'mesa-verde', 'four-corners', 'dinosaur']);
const WET = new Set(['pueblo-reservoir', 'trinidad-lake', 'horsetooth', 'grand-mesa', 'aspen', 'pueblo']);
const PLAINS = new Set(['pawnee', 'sterling', 'fort-morgan', 'limon', 'burlington', 'lamar', 'la-junta', 'bents-fort', 'brighton', 'greeley', 'loveland', 'longmont']);
const DIRECT: Record<string, Theme> = {
  walsenburg: V.prairie, trinidad: V.highway, pueblo: V.mill, 'colorado-springs': V.fortress,
  'garden-gods': V.redrock, 'pikes-peak': V.snow, denver: V.rooftops, aurora: V.rooftops,
  boulder: V.campus, 'fort-collins': V.lab, aspen: V.chalet, 'grand-junction': V.mesa, 'grand-mesa': V.mesa,
  dia: V.highway, 'royal-gorge': V.gorge, 'black-canyon': V.gorge, 'sand-dunes': V.dunes,
};

function themeFor(node: WorldNode): Theme {
  const id = node.id;
  const t = DIRECT[id]
    ?? (SNOW.has(id) ? V.alpine
      : RED.has(id) ? V.redrock
        : node.kind === 'base' ? V.fortress
          : PLAINS.has(id) ? V.plains
            : node.kind === 'city' ? V.city
              : node.kind === 'town' ? V.foothilltown
                : V.foothills);
  return WET.has(id) ? { ...t, water: true } : t;
}

/* -------------------------------- map generation -------------------------------- */

function grid<T>(v: T): T[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => v));
}

const inSpawn = (x: number, z: number) => z <= 1 || z >= SIZE - 2 || (z <= 2 && x >= 3 && x <= 5) || (z >= SIZE - 3 && x >= 3 && x <= 5);

export function genMap(node: WorldNode, salt: number): BattleMap {
  const theme = themeFor(node);
  const rnd = mulberry(hashStr(node.id + ':' + salt));
  const heights = grid(0), blocked = grid(false), water = grid(false), city = grid(false), road = grid(false);

  const roll = (): number => {
    const n = rnd();
    switch (theme.profile) {
      case 'flat': return n < 0.85 ? 0 : 1;
      case 'dunes': return n < 0.7 ? 0 : 1;
      case 'urban': return n < 0.8 ? 0 : 1;
      case 'rolling': return n < 0.45 ? 0 : n < 0.75 ? 1 : n < 0.93 ? 2 : 3;
      case 'peaks': return n < 0.25 ? 0 : n < 0.5 ? 1 : n < 0.78 ? 2 : 3;
      case 'gorge': return 2;
      case 'mesa': return 0;
    }
  };
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) heights[x][z] = roll();

  if (node.id === 'red-rocks') {
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) heights[x][z] = Math.max(0, 3 - Math.floor((Math.abs(x - 4) + Math.abs(z - 4)) / 2));
  }
  if (theme.profile === 'mesa') {
    const x0 = 1 + Math.floor(rnd() * 2), x1 = 6 + Math.floor(rnd() * 2);
    for (let x = x0; x <= x1; x++) for (let z = 2; z <= 6; z++) {
      const inner = x > x0 && x < x1 && z > 2 && z < 6;
      heights[x][z] = inner ? (rnd() < 0.15 ? 3 : 2) : 1;
    }
  }
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) if (z >= SIZE - 2 || z <= 1) heights[x][z] = Math.min(heights[x][z], 1);

  if (theme.profile === 'gorge') {
    for (let z = 0; z < SIZE; z++) { heights[4][z] = 0; if (z !== 4) blocked[4][z] = true; }
  }
  if (theme.road) {
    for (let x = 0; x < SIZE; x++) {
      road[x][4] = true; heights[x][4] = 0;
      heights[x][3] = Math.min(heights[x][3], 1); heights[x][5] = Math.min(heights[x][5], 1);
    }
  }
  if (theme.water) {
    const cx = 3 + Math.floor(rnd() * 3), cz = 3 + Math.floor(rnd() * 3);
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      if (Math.hypot(x - cx, (z - cz) * 1.3) < 1.7 && !inSpawn(x, z) && !road[x][z] && !(theme.profile === 'gorge' && x === 4)) {
        water[x][z] = true; blocked[x][z] = true; heights[x][z] = 0;
      }
    }
  }
  if (theme.obstacle) {
    let placed = 0, guard = 0;
    while (placed < theme.obstacleCount && guard++ < 120) {
      const x = Math.floor(rnd() * SIZE), z = 2 + Math.floor(rnd() * (SIZE - 4));
      if (x === 4 || blocked[x][z] || road[x][z]) continue;
      blocked[x][z] = true; city[x][z] = true; heights[x][z] = Math.min(heights[x][z], 1); placed++;
    }
  }
  return { heights, blocked, water, city, road, theme };
}
