import { nodeById, WORLD_NODES, WORLD_NODE_COUNT } from './world';
import { MAIN_QUEST } from './story';
import { JOBS, SKILL_SLOT_COUNT, abilityById, isSlottableAbility } from './jobs';
import type { Character } from './store';

export type SaveSlotId = 'auto' | 'slot1' | 'slot2' | 'slot3';

export const SAVE_SLOTS: { id: SaveSlotId; label: string; auto?: boolean }[] = [
  { id: 'auto', label: 'AUTOSAVE', auto: true },
  { id: 'slot1', label: 'SLOT 01' },
  { id: 'slot2', label: 'SLOT 02' },
  { id: 'slot3', label: 'SLOT 03' },
];

export interface SavePayload {
  party: Character[];
  reserves: Character[];
  gold: number;
  inventory: string[];
  visited: string[];
  currentNode: string;
  storyIndex: number;
  hasArtillery: boolean;
  hasAirstrike: boolean;
  log: string[];
  finale: boolean;
  battlesWon: number;
  playTimeSec: number;
}

interface SaveSummary {
  locationName: string;
  region: string;
  questLabel: string;
  visitedCount: number;
  totalNodes: number;
  battlesWon: number;
  gold: number;
  playTimeSec: number;
  partyPreview: { id: string; name: string; icon: string; color: string; level: number; jobId: string }[];
}

interface SaveRecord {
  version: 1;
  /** Campaign route revision; older save slots used a shorter 13-stop quest itinerary. */
  campaignVersion: 2;
  slot: SaveSlotId;
  savedAt: number;
  summary: SaveSummary;
  data: SavePayload;
}

const STORAGE_KEY = 'carbon_king_tactics_saves_v1';
const CAMPAIGN_VERSION = 2;
const memoryFallback = new Map<string, string>();

// Preserve the player's exact story milestone when loading v1 campaign saves.
const LEGACY_QUEST_INDEX: Record<number, number> = {
  0: 0, 1: 4, 2: 5, 3: 8, 4: 13, 5: 18, 6: 19, 7: 28,
  8: 35, 9: 41, 10: 50, 11: 51, 12: 52, 13: 53,
};

function migrateQuestIndex(index: number): number {
  const key = Math.max(0, Math.min(13, Math.floor(index || 0)));
  return LEGACY_QUEST_INDEX[key] ?? MAIN_QUEST.length;
}

function readRawStore(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryFallback.get(STORAGE_KEY) ?? null;
  } catch {
    return memoryFallback.get(STORAGE_KEY) ?? null;
  }
}

function writeRawStore(json: string): void {
  memoryFallback.set(STORAGE_KEY, json);
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Sandboxed or quota-full storage still keeps session saves in memoryFallback and supports JSON export.
  }
}

function cloneData<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const VALID_NODES = new Set(WORLD_NODES.map(n => n.id));
const VALID_JOBS = new Set(JOBS.map(j => j.id));

function sanitizeCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Character>;
  if (typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const jobId = typeof c.jobId === 'string' && VALID_JOBS.has(c.jobId) ? c.jobId : 'drifter';
  const eq = (c.equip && typeof c.equip === 'object' ? c.equip : {}) as Partial<Character['equip']>;
  const learned = [...new Set(Array.isArray(c.learned) ? c.learned.filter((x): x is string => typeof x === 'string') : [])];
  const rawSlots = Array.isArray(c.skillSlots) ? c.skillSlots : null;
  // Older saves predate skill slots: auto-slot their learned active/flash abilities.
  let skillSlots = rawSlots
    ? Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => {
        const id = rawSlots[i];
        return typeof id === 'string' && learned.includes(id) ? id : null;
      })
    : learned.filter(id => isSlottableAbility(abilityById(id))).slice(0, SKILL_SLOT_COUNT);
  while (skillSlots.length < SKILL_SLOT_COUNT) skillSlots.push(null);
  return {
    id: c.id,
    name: c.name.slice(0, 40),
    icon: typeof c.icon === 'string' ? c.icon : 'user',
    color: typeof c.color === 'string' ? c.color : '#a8a29e',
    level: Math.max(1, Math.min(99, Math.floor(Number(c.level) || 1))),
    xp: Math.max(0, Math.floor(Number(c.xp) || 0)),
    jobId,
    jp: c.jp && typeof c.jp === 'object' ? (c.jp as Record<string, number>) : {},
    jpEarned: c.jpEarned && typeof c.jpEarned === 'object' ? (c.jpEarned as Record<string, number>) : {},
    learned,
    skillSlots,
    mastered: Array.isArray(c.mastered) ? c.mastered.filter((x): x is string => typeof x === 'string') : [],
    equip: {
      weapon: typeof eq.weapon === 'string' ? eq.weapon : null,
      helmet: typeof eq.helmet === 'string' ? eq.helmet : null,
      armor: typeof eq.armor === 'string' ? eq.armor : null,
      shield: typeof eq.shield === 'string' ? eq.shield : null,
      accessory: typeof eq.accessory === 'string' ? eq.accessory : null,
    },
    hp: Math.max(1, Math.floor(Number(c.hp) || 40)),
    kills: Math.max(0, Math.floor(Number(c.kills) || 0)),
  };
}

function sanitizePayload(raw: unknown): SavePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<SavePayload>;
  if (!Array.isArray(d.party) || d.party.length === 0) return null;
  const party = d.party.map(sanitizeCharacter).filter((c): c is Character => c !== null);
  if (party.length === 0) return null;
  const reserves = Array.isArray(d.reserves) ? d.reserves.map(sanitizeCharacter).filter((c): c is Character => c !== null) : [];
  const currentNode = typeof d.currentNode === 'string' && VALID_NODES.has(d.currentNode) ? d.currentNode : 'walsenburg';
  const visited = Array.isArray(d.visited) ? d.visited.filter((x): x is string => typeof x === 'string' && VALID_NODES.has(x)) : [];
  return {
    party,
    reserves,
    gold: Math.max(0, Math.floor(Number(d.gold) || 0)),
    inventory: Array.isArray(d.inventory) ? d.inventory.filter((x): x is string => typeof x === 'string') : [],
    visited,
    currentNode,
    storyIndex: Math.max(0, Math.min(MAIN_QUEST.length, Math.floor(Number(d.storyIndex) || 0))),
    hasArtillery: Boolean(d.hasArtillery),
    hasAirstrike: Boolean(d.hasAirstrike),
    log: Array.isArray(d.log) ? d.log.filter((x): x is string => typeof x === 'string').slice(-40) : ['Campaign restored from archive.'],
    finale: Boolean(d.finale),
    battlesWon: Math.max(0, Math.floor(Number(d.battlesWon) || 0)),
    playTimeSec: Math.max(0, Math.floor(Number(d.playTimeSec) || 0)),
  };
}

function buildSummary(data: SavePayload): SaveSummary {
  const node = nodeById(data.currentNode) ?? WORLD_NODES[0];
  const questLabel =
    data.storyIndex >= MAIN_QUEST.length
      ? 'Crown Bearer · Free Roam'
      : `Quest ${data.storyIndex + 1}/${MAIN_QUEST.length} · ${nodeById(MAIN_QUEST[data.storyIndex])?.name ?? ''}`;
  return {
    locationName: node.name,
    region: node.region,
    questLabel,
    visitedCount: data.visited.length,
    totalNodes: WORLD_NODE_COUNT,
    battlesWon: data.battlesWon,
    gold: data.gold,
    playTimeSec: data.playTimeSec,
    partyPreview: data.party.slice(0, 6).map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      level: c.level,
      jobId: c.jobId,
    })),
  };
}

type SaveMap = Partial<Record<SaveSlotId, SaveRecord>>;

function loadAllMap(): SaveMap {
  const raw = readRawStore();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: SaveMap = {};
    let migrated = false;
    for (const { id } of SAVE_SLOTS) {
      const rec = parsed[id] as Partial<SaveRecord> | undefined;
      if (!rec || typeof rec !== 'object') continue;
      const clean = sanitizePayload(rec.data);
      if (!clean) continue;
      if (rec.campaignVersion !== CAMPAIGN_VERSION) {
        clean.storyIndex = migrateQuestIndex(clean.storyIndex);
        migrated = true;
      }
      out[id] = {
        version: 1,
        campaignVersion: CAMPAIGN_VERSION,
        slot: id,
        savedAt: typeof rec.savedAt === 'number' ? rec.savedAt : Date.now(),
        summary: buildSummary(clean),
        data: clean,
      };
    }
    if (migrated) persistMap(out);
    return out;
  } catch {
    return {};
  }
}

function persistMap(map: SaveMap): void {
  writeRawStore(JSON.stringify(map));
}

export function listSaves(): Record<SaveSlotId, SaveRecord | null> {
  const map = loadAllMap();
  return {
    auto: map.auto ?? null,
    slot1: map.slot1 ?? null,
    slot2: map.slot2 ?? null,
    slot3: map.slot3 ?? null,
  };
}

export function latestSave(): SaveRecord | null {
  const all = Object.values(listSaves()).filter((r): r is SaveRecord => r !== null);
  if (all.length === 0) return null;
  all.sort((a, b) => b.savedAt - a.savedAt);
  return all[0];
}

export function writeSave(slot: SaveSlotId, payload: SavePayload): SaveRecord {
  const map = loadAllMap();
  const data = cloneData(payload);
  const record: SaveRecord = {
    version: 1,
    campaignVersion: CAMPAIGN_VERSION,
    slot,
    savedAt: Date.now(),
    summary: buildSummary(data),
    data,
  };
  map[slot] = record;
  persistMap(map);
  return record;
}

export function readSave(slot: SaveSlotId): SaveRecord | null {
  return loadAllMap()[slot] ?? null;
}

export function deleteSave(slot: SaveSlotId): void {
  const map = loadAllMap();
  delete map[slot];
  persistMap(map);
}

export function exportSaveJson(slot: SaveSlotId): string | null {
  const rec = readSave(slot);
  if (!rec) return null;
  return JSON.stringify(rec, null, 2);
}

export function importSaveJson(rawJson: string, targetSlot: SaveSlotId): SaveRecord | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<SaveRecord> & Partial<SavePayload>;
    const payload = sanitizePayload(parsed.data ?? parsed);
    if (!payload) return null;
    if (parsed.campaignVersion !== CAMPAIGN_VERSION) payload.storyIndex = migrateQuestIndex(payload.storyIndex);
    return writeSave(targetSlot, payload);
  } catch {
    return null;
  }
}

export function formatPlayTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function formatSavedAt(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 15) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
