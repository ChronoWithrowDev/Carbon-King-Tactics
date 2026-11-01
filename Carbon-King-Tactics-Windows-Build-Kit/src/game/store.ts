import { create } from 'zustand';
import { neighborsOf, nodeById } from './world';
import { JOBS, SKILL_SLOT_COUNT, abilityById, isSlottableAbility, jobById, jobCostTotal, SHIELD_OK } from './jobs';
import { SHOP, itemById } from './gear';
import { STORY_BEATS, MAIN_QUEST, flavorFor, type Line } from './story';
import {
  writeSave, readSave, latestSave, deleteSave, importSaveJson,
  type SaveSlotId, type SavePayload,
} from './saves';

export type Screen = 'title' | 'map' | 'party' | 'shop' | 'tavern' | 'story' | 'battle' | 'ending' | 'saves';

interface Equipment { weapon: string | null; helmet: string | null; armor: string | null; shield: string | null; accessory: string | null; }
export interface Character {
  id: string; name: string; icon: string; color: string;
  level: number; xp: number;
  jobId: string;
  jp: Record<string, number>;       // spendable JP pool per job
  jpEarned: Record<string, number>; // lifetime JP per job (drives mastery)
  learned: string[];
  /** Up to six active/flash abilities chosen from every learned job ability. */
  skillSlots: (string | null)[];
  mastered: string[];
  equip: Equipment;
  hp: number; // current
  kills?: number;
}

interface GameState {
  screen: Screen;
  savesReturnTo: Screen;
  party: Character[];
  reserves: Character[];
  gold: number;
  inventory: string[];
  visited: string[];
  currentNode: string;
  storyIndex: number;
  // story playback
  storyLines: Line[];
  storyTitle: string;
  storyChapter: string;
  pendingNode: string | null;
  activeBeatKey: string | null; // which beat is playing (null = flavor/random)
  // unlocks / progress
  hasArtillery: boolean;
  hasAirstrike: boolean;
  log: string[];
  finale: boolean;
  battlesWon: number;
  playTimeSec: number;
  saveRev: number;
  // toast
  toast: string | null;
  toastId: number;
  // actions
  startGame: () => void;
  setScreen: (s: Screen) => void;
  openSaves: (from?: Screen) => void;
  saveToSlot: (slot: SaveSlotId, silent?: boolean) => void;
  loadFromSlot: (slot: SaveSlotId) => boolean;
  continueLatest: () => boolean;
  removeSaveSlot: (slot: SaveSlotId) => void;
  importToSlot: (rawJson: string, slot: SaveSlotId) => boolean;
  tickPlayTime: (sec: number) => void;
  notify: (m: string) => void;
  travelTo: (id: string) => void;
  advanceStory: () => void;
  finishStory: () => void;
  winBattle: (xp: number, jp: number, lootGold: number) => void;
  loseBattle: () => void;
  healParty: () => void;
  switchJob: (charId: string, jobId: string) => void;
  learnAbility: (charId: string, abilityId: string) => void;
  assignSkillSlot: (charId: string, slotIndex: number, abilityId: string | null) => void;
  equipItem: (charId: string, itemId: string) => void;
  buyItem: (itemId: string) => void;
  hireStock: (jobId: string) => void;
  dismissToReserve: (charId: string) => void;
  promoteReserve: (charId: string) => void;
  addLog: (m: string) => void;
}

export function baseStats(c: Character) {
  const job = jobById(c.jobId);
  const lvl = c.level;
  let hp = 40 + lvl * job.growth.hp * 0.6;
  let atk = 5 + lvl * job.growth.atk * 0.45;
  let def = 3 + lvl * job.growth.def * 0.4;
  let spd = 4 + lvl * job.growth.spd * 0.35;
  let mag = 4 + lvl * job.growth.mag * 0.45;
  for (const mj of c.mastered) {
    const j = JOBS.find(x => x.id === mj);
    if (!j) continue;
    hp += j.masteryStat.hp ?? 0;
    atk += j.masteryStat.atk ?? 0;
    def += j.masteryStat.def ?? 0;
    spd += j.masteryStat.spd ?? 0;
    mag += j.masteryStat.mag ?? 0;
  }
  const eq = [c.equip.weapon, c.equip.helmet, c.equip.armor, c.equip.shield, c.equip.accessory].filter(Boolean) as string[];
  for (const id of eq) {
    const it = SHOP.find(s => s.id === id);
    if (!it) continue;
    atk += it.atk ?? 0; def += it.def ?? 0; mag += it.mag ?? 0; spd += it.spd ?? 0; hp += it.hp ?? 0;
  }
  return { maxHp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), spd: Math.round(spd), mag: Math.round(mag), move: job.move, jump: job.jump };
}

function mkChar(o: Partial<Character> & { id: string; name: string }): Character {
  const c = {
    icon: 'user', color: '#fff', level: 1, xp: 0, jobId: 'drifter',
    jp: { drifter: 0 }, jpEarned: {}, learned: [], skillSlots: Array(SKILL_SLOT_COUNT).fill(null), mastered: [],
    equip: { weapon: null, helmet: null, armor: null, shield: null, accessory: null },
    hp: 50, ...o,
  } as Character;
  // New characters start with their known active/flash abilities in the first free slots.
  c.skillSlots = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => c.skillSlots[i] ?? null);
  for (const id of c.learned) {
    const ability = abilityById(id);
    if (isSlottableAbility(ability) && !c.skillSlots.includes(id)) {
      const empty = c.skillSlots.indexOf(null);
      if (empty >= 0) c.skillSlots[empty] = id;
    }
  }
  return c;
}

function snapshotOf(st: GameState): SavePayload {
  return {
    party: st.party,
    reserves: st.reserves,
    gold: st.gold,
    inventory: st.inventory,
    visited: st.visited,
    currentNode: st.currentNode,
    storyIndex: st.storyIndex,
    hasArtillery: st.hasArtillery,
    hasAirstrike: st.hasAirstrike,
    log: st.log,
    finale: st.finale,
    battlesWon: st.battlesWon,
    playTimeSec: st.playTimeSec,
  };
}

const STOCK_NAMES = ['Wren Kessler', 'Dakota Blue', 'Hollis Vane', 'Frankie Lode', 'Rio Sandoval', 'Kit Marlowe', 'Sam Delacroix', 'Lou Cardenas', 'Ash Teller', 'Noa Reyes', 'Gus Pallor', 'Ivy Quill', 'Beau Tackett', 'Moss Aguilar', 'Rue Calloway', 'Sol Brandt'];
const STOCK_ICONS = ['user', 'hardhat', 'rocket', 'music', 'anchor', 'bike', 'camera', 'coffee', 'flag', 'wrench'];
const STOCK_COLORS = ['#a8a29e', '#60a5fa', '#34d399', '#fbbf24', '#f97316', '#f472b6', '#93c5fd'];

export const useGame = create<GameState>((set, get) => {
  const autoSave = () => {
    const st = get();
    if (st.party.length === 0) return;
    writeSave('auto', snapshotOf(st));
    set(s => ({ saveRev: s.saveRev + 1 }));
  };

  const applyPayload = (data: SavePayload, label: string) => {
    const party = data.party.map(c => ({ ...c, hp: Math.min(baseStats(c).maxHp, Math.max(1, c.hp)) }));
    set(s => ({
      ...data,
      party,
      storyLines: [],
      storyTitle: '',
      storyChapter: '',
      pendingNode: null,
      activeBeatKey: null,
      finale: false,
      screen: 'map',
      savesReturnTo: 'map',
      saveRev: s.saveRev + 1,
      log: [...data.log.slice(-39), `Loaded ${label} — ${nodeById(data.currentNode).name}.`],
    }));
    get().notify(`Loaded ${label} · ${nodeById(data.currentNode).name}`);
  };

  return {
    screen: 'title',
    savesReturnTo: 'title',
    party: [], reserves: [], gold: 300, inventory: [],
    visited: [], currentNode: 'walsenburg', storyIndex: 0,
    storyLines: [], storyTitle: '', storyChapter: '',
    pendingNode: null, activeBeatKey: null,
    hasArtillery: false, hasAirstrike: false,
    log: ['Lattice link v41.3 — Colorado mesh online.'],
    battlesWon: 0, finale: false,
    playTimeSec: 0, saveRev: 0,
    toast: null, toastId: 0,

    notify: (m) => set({ toast: m, toastId: Date.now() }),

    tickPlayTime: (sec) => set(s => (s.party.length > 0 && s.screen !== 'title' ? { playTimeSec: s.playTimeSec + sec } : s)),

    openSaves: (from) => set(s => ({ savesReturnTo: from ?? s.screen, screen: 'saves' })),

    saveToSlot: (slot, silent = false) => {
      const st = get();
      if (st.party.length === 0) return;
      writeSave(slot, snapshotOf(st));
      set(s => ({ saveRev: s.saveRev + 1 }));
      if (!silent) {
        const tag = slot === 'auto' ? 'Autosave' : `Slot ${slot.replace('slot', '0')}`;
        st.notify(`Saved to ${tag} · ${nodeById(st.currentNode).name}`);
      }
    },

    loadFromSlot: (slot) => {
      const rec = readSave(slot);
      if (!rec) { get().notify('Save slot is empty.'); return false; }
      const tag = slot === 'auto' ? 'Autosave' : `Slot ${slot.replace('slot', '0')}`;
      applyPayload(rec.data, tag);
      return true;
    },

    continueLatest: () => {
      const rec = latestSave();
      if (!rec) { get().notify('No saved campaign found.'); return false; }
      const tag = rec.slot === 'auto' ? 'Autosave' : `Slot ${rec.slot.replace('slot', '0')}`;
      applyPayload(rec.data, tag);
      return true;
    },

    removeSaveSlot: (slot) => {
      deleteSave(slot);
      set(s => ({ saveRev: s.saveRev + 1 }));
      const tag = slot === 'auto' ? 'Autosave' : `Slot ${slot.replace('slot', '0')}`;
      get().notify(`Deleted ${tag}.`);
    },

    importToSlot: (rawJson, slot) => {
      const rec = importSaveJson(rawJson, slot);
      if (!rec) { get().notify('Invalid save file.'); return false; }
      set(s => ({ saveRev: s.saveRev + 1 }));
      const tag = slot === 'auto' ? 'Autosave' : `Slot ${slot.replace('slot', '0')}`;
      get().notify(`Imported campaign into ${tag} · ${rec.summary.locationName}`);
      return true;
    },

    startGame: () => {
      const rye = mkChar({ id: 'rye', name: 'Rye Calloway', icon: 'dog', color: '#facc15', level: 2, jobId: 'drifter', jp: { drifter: 120 }, jpEarned: { drifter: 120 }, learned: ['d-focus'], equip: { weapon: 'w-rusty', helmet: null, armor: 'a-flannel', shield: null, accessory: null } });
      const june = mkChar({ id: 'june', name: 'June Pruitt', icon: 'heartpulse', color: '#f472b6', level: 2, jobId: 'surgeon', jp: { surgeon: 120 }, jpEarned: { surgeon: 120 }, learned: ['m-triage'], equip: { weapon: 'w-wrench', helmet: null, armor: 'a-flannel', shield: null, accessory: null } });
      const echo = mkChar({ id: 'echo', name: 'Echo-7', icon: 'orbit', color: '#5eead4', level: 2, jobId: 'echo-vessel', jp: {}, jpEarned: {}, learned: ['ev-flashheal', 'ev-overclock'], equip: { weapon: 'w-spark', helmet: 'h-halo', armor: null, shield: null, accessory: null } });
      for (const c of [rye, june, echo]) c.hp = baseStats(c).maxHp;
      set({
        party: [rye, june, echo], reserves: [], gold: 320,
        inventory: ['w-snub', 'w-pitch', 'h-cap', 'a-flannel', 's-lid', 'x-coffee'],
        visited: [], currentNode: 'walsenburg', storyIndex: 0,
        screen: 'map', savesReturnTo: 'map', finale: false, battlesWon: 0, playTimeSec: 0,
        hasArtillery: false, hasAirstrike: false,
        log: ['CH 1 — Walsenburg. The Corazon Bar. Silas at the door.'],
      });
      autoSave();
      get().travelTo('walsenburg');
    },

    setScreen: (s) => set({ screen: s }),

    travelTo: (id) => {
      const st = get();
      if (id !== st.currentNode && !reachableNodes(st.visited, st.currentNode).includes(id)) {
        st.notify('No road there yet — expand from visited nodes.');
        return;
      }
      const first = !st.visited.includes(id);
      const isQuestTarget = MAIN_QUEST[st.storyIndex] === id;
      // The expanded itinerary deliberately sends the party back to Walsenburg after Fort Carson.
      let beatKey: string | null = null;
      if (id === 'walsenburg' && !first && isQuestTarget && st.storyIndex > 0) beatKey = 'walsenburg-return';
      else if (STORY_BEATS[id] && (first || isQuestTarget)) beatKey = id;

      if (beatKey) {
        const beat = STORY_BEATS[beatKey];
        set({ storyLines: beat.lines, storyTitle: beat.title, storyChapter: beat.chapter, pendingNode: id, activeBeatKey: beatKey, screen: 'story', currentNode: id });
      } else if (first) {
        set({ storyLines: flavorFor(id), storyTitle: nodeById(id).name, storyChapter: `EN ROUTE — ${nodeById(id).region}`, pendingNode: id, activeBeatKey: null, screen: 'story', currentNode: id });
      } else if (Math.random() < 0.35) {
        set({ storyLines: flavorFor(id), storyTitle: nodeById(id).name + ' — AMBUSH', storyChapter: 'RANDOM ENCOUNTER', pendingNode: id, activeBeatKey: null, screen: 'story', currentNode: id });
      } else {
        const healed = st.party.map(p => ({ ...p, hp: Math.min(baseStats(p).maxHp, p.hp + Math.round(baseStats(p).maxHp * 0.25)) }));
        set({ currentNode: id, party: healed });
        get().addLog(`Moved to ${nodeById(id).name} — no contact. Rested +25%.`);
        autoSave();
      }
    },

    advanceStory: () => {
      const st = get();
      if (st.storyLines.length > 1) set({ storyLines: st.storyLines.slice(1) });
      else st.finishStory();
    },

    finishStory: () => {
      const st = get();
      const nodeId = st.pendingNode ?? st.currentNode;
      const beat = st.activeBeatKey ? STORY_BEATS[st.activeBeatKey] : undefined;
      let party = [...st.party];
      let gold = st.gold;
      let hasArtillery = st.hasArtillery, hasAirstrike = st.hasAirstrike;
      if (beat) {
        for (const j of beat.joins ?? []) {
          if (party.find(p => p.id === j)) continue;
          if (j === 'maya') {
            const m = mkChar({ id: 'maya', name: 'Maya Okafor', icon: 'terminal', color: '#93c5fd', level: Math.max(3, party[0]?.level ?? 3), jobId: 'ghost-signal', jp: {}, jpEarned: {}, learned: ['gs-jam', 'gs-skip'], equip: { weapon: 'w-grease', helmet: 'h-halo', armor: 'a-vest', shield: null, accessory: null } });
            m.hp = baseStats(m).maxHp; party.push(m);
            st.addLog('Maya Okafor joined the party.');
          }
          if (j === 'silas') {
            const s = mkChar({ id: 'silas', name: 'Silas Pike', icon: 'coins', color: '#fb923c', level: Math.max(4, party[0]?.level ?? 4), jobId: 'warden', jp: { warden: 200 }, jpEarned: { warden: 200 }, learned: ['w-designate'], equip: { weapon: 'w-compact', helmet: 'h-ballistic', armor: 'a-vest', shield: null, accessory: 'x-lucky' } });
            s.hp = baseStats(s).maxHp; party.push(s);
            st.addLog('Silas Pike joined the party.');
          }
        }
        if (beat.unlocks?.includes('artillery')) { hasArtillery = true; st.addLog('ARTILLERY unlocked — capture bases to call fire.'); }
        if (beat.unlocks?.includes('airstrike')) { hasArtillery = true; hasAirstrike = true; st.addLog('AIRSTRIKE unlocked.'); }
        if (beat.rewardGold) gold += beat.rewardGold;
        if (nodeId === 'cheyenne-mtn') {
          party = party.map(p => p.id === 'rye' ? { ...p, jp: { ...p.jp, 'carbon-king': p.jp['carbon-king'] ?? 0 }, jpEarned: { ...p.jpEarned, 'carbon-king': p.jpEarned['carbon-king'] ?? 0 } } : p);
          st.addLog('Rye can now become the CARBON KING.');
        }
        if (beat.isFinale) {
          set({ party, gold, hasArtillery, hasAirstrike, storyLines: [], screen: 'battle', finale: true });
          return;
        }
      } else {
        gold += 20; // scout fee
      }
      set({ party, gold, hasArtillery, hasAirstrike, storyLines: [], screen: 'battle' });
    },

    winBattle: (xp, jp, lootGold) => {
      const st = get();
      const nodeId = st.pendingNode ?? st.currentNode;
      const visited = st.visited.includes(nodeId) ? st.visited : [...st.visited, nodeId];
      const party = st.party.map(p => {
        let xp2 = p.xp + xp;
        let lvl = p.level;
        while (xp2 >= lvl * 100) { xp2 -= lvl * 100; lvl++; }
        const jpMap = { ...p.jp, [p.jobId]: (p.jp[p.jobId] ?? 0) + jp };
        const jpLife = { ...p.jpEarned, [p.jobId]: (p.jpEarned[p.jobId] ?? 0) + jp };
        const job = jobById(p.jobId);
        const mastered = [...p.mastered];
        if (!job.unique && (jpLife[p.jobId] ?? 0) >= jobCostTotal(p.jobId) && !mastered.includes(p.jobId)) {
          mastered.push(p.jobId);
          setTimeout(() => get().notify(`${p.name} MASTERED ${job.name}.`), 100);
        }
        const c: Character = { ...p, xp: xp2, level: lvl, jp: jpMap, jpEarned: jpLife, mastered, kills: (p.kills ?? 0) + 1 };
        const reviveHp = p.hp <= 0 ? Math.round(baseStats(c).maxHp * 0.3) : p.hp;
        c.hp = Math.min(baseStats(c).maxHp, reviveHp + Math.round(baseStats(c).maxHp * 0.5));
        return c;
      });
      const battlesWon = st.battlesWon + 1;
      const gold = st.gold + lootGold;
      const n = nodeById(nodeId);
      let hasArtillery = st.hasArtillery, hasAirstrike = st.hasAirstrike;
      if (n.isBase) hasArtillery = true;
      if (n.id === 'dia') { hasArtillery = true; hasAirstrike = true; }
      let storyIndex = st.storyIndex;
      if (MAIN_QUEST[storyIndex] === nodeId) storyIndex++;
      if (st.finale) {
        set({ party, visited, gold, battlesWon, screen: 'ending', pendingNode: null, activeBeatKey: null, hasArtillery, hasAirstrike, storyIndex });
        autoSave();
        return;
      }
      set({ party, visited, gold, battlesWon, screen: 'map', pendingNode: null, activeBeatKey: null, hasArtillery, hasAirstrike, storyIndex });
      get().addLog(`Victory at ${n.name}. +${xp} XP +${jp} JP +${lootGold}G.${n.isBase ? ' BASE CAPTURED — fire support online.' : ''}`);
      autoSave();
    },

    loseBattle: () => {
      const st = get();
      const party = st.party.map(p => ({ ...p, hp: baseStats(p).maxHp }));
      set({ party, screen: 'map', pendingNode: null, activeBeatKey: null, finale: false });
      get().addLog('Squad wiped. The Choir rewinds you to the map.');
      autoSave();
    },

    healParty: () => {
      const st = get();
      if (st.gold < 50) { st.notify('Not enough gold (50G).'); return; }
      set({ party: st.party.map(p => ({ ...p, hp: baseStats(p).maxHp })), gold: st.gold - 50 });
      st.notify('Party fully healed.');
      autoSave();
    },

    switchJob: (charId, jobId) => {
      const st = get();
      set({
        party: st.party.map(p => {
          if (p.id !== charId) return p;
          const c = { ...p, jobId, jp: { ...p.jp, [jobId]: p.jp[jobId] ?? 0 }, jpEarned: { ...p.jpEarned, [jobId]: p.jpEarned[jobId] ?? 0 } };
          const job = jobById(jobId);
          const w = c.equip.weapon ? itemById(c.equip.weapon) : null;
          if (w?.weaponType && !job.weapons.includes(w.weaponType)) c.equip.weapon = null;
          if (c.equip.shield && !job.canShield) c.equip.shield = null;
          const w2 = c.equip.weapon ? itemById(c.equip.weapon) : null;
          if (w2?.weaponType && !SHIELD_OK[w2.weaponType]) c.equip.shield = null;
          c.hp = Math.min(baseStats(c).maxHp, c.hp);
          return c;
        }),
      });
      st.notify(`Job changed to ${jobById(jobId).name}.`);
      autoSave();
    },

    learnAbility: (charId, abilityId) => {
      const st = get();
      let cost = 0, jobId = '', aname = '';
      for (const j of JOBS) { const a = j.abilities.find(x => x.id === abilityId); if (a) { cost = a.jpCost; jobId = j.id; aname = a.name; } }
      const c = st.party.find(p => p.id === charId);
      if (!c || c.learned.includes(abilityId)) return;
      if ((c.jp[jobId] ?? 0) < cost) { st.notify('Not enough banked JP in that job.'); return; }
      set({
        party: st.party.map(p => {
          if (p.id !== charId) return p;
          const learned = [...p.learned, abilityId];
          const skillSlots = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => p.skillSlots[i] ?? null);
          const ability = abilityById(abilityId);
          if (isSlottableAbility(ability) && !skillSlots.includes(abilityId)) {
            const empty = skillSlots.indexOf(null);
            if (empty >= 0) skillSlots[empty] = abilityId;
          }
          return { ...p, jp: { ...p.jp, [jobId]: p.jp[jobId] - cost }, learned, skillSlots };
        }),
      });
      st.notify(`Learned ${aname}.`);
      autoSave();
    },

    assignSkillSlot: (charId, slotIndex, abilityId) => {
      const st = get();
      const c = st.party.find(p => p.id === charId);
      if (!c) return;
      const skillSlots = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => c.skillSlots[i] ?? null);

      if (abilityId === null) {
        if (slotIndex >= 0 && slotIndex < SKILL_SLOT_COUNT) skillSlots[slotIndex] = null;
      } else {
        const ability = abilityById(abilityId);
        if (!isSlottableAbility(ability)) { st.notify('Only learned active or flash abilities can occupy a skill slot.'); return; }
        if (!c.learned.includes(abilityId)) { st.notify('Learn that ability first.'); return; }
        if (skillSlots.includes(abilityId)) { st.notify(`${ability.name} is already in a skill slot.`); return; }
        const target = slotIndex === -1 ? skillSlots.indexOf(null) : slotIndex;
        if (target < 0 || target >= SKILL_SLOT_COUNT) { st.notify('All six skill slots are full — clear one first.'); return; }
        skillSlots[target] = abilityId;
      }

      set({ party: st.party.map(p => (p.id === charId ? { ...p, skillSlots } : p)) });
      st.notify(abilityId ? `${abilityById(abilityId)?.name ?? 'Skill'} assigned to slot ${skillSlots.indexOf(abilityId) + 1}.` : 'Skill slot cleared.');
      autoSave();
    },

    equipItem: (charId, itemId) => {
      const st = get();
      const item = itemById(itemId);
      const c = st.party.find(p => p.id === charId);
      if (!c) return;
      const job = jobById(c.jobId);
      if (item.slot === 'weapon' && item.weaponType && !job.weapons.includes(item.weaponType)) {
        st.notify(`${job.name} cannot use ${item.weaponType}.`); return;
      }
      if (item.slot === 'shield') {
        if (!job.canShield) { st.notify(`${job.name} cannot equip shields.`); return; }
        const w = c.equip.weapon ? itemById(c.equip.weapon) : null;
        if (w?.weaponType && !SHIELD_OK[w.weaponType]) { st.notify('Shields only pair with one-handed melee weapons (sword or mace).'); return; }
      }
      const swappedOut = [c.equip[item.slot], item.slot === 'weapon' && item.weaponType && !SHIELD_OK[item.weaponType] ? c.equip.shield : null].filter((x): x is string => !!x && x !== itemId);
      set({
        inventory: [...st.inventory, ...swappedOut.filter(id => !st.inventory.includes(id))],
        party: st.party.map(p => {
          if (p.id !== charId) return p;
          if (item.slot === 'weapon' && item.weaponType && !SHIELD_OK[item.weaponType] && p.equip.shield) {
            return { ...p, equip: { ...p.equip, weapon: itemId, shield: null } };
          }
          return { ...p, equip: { ...p.equip, [item.slot]: itemId } };
        }),
      });
      autoSave();
    },

    buyItem: (itemId) => {
      const st = get();
      const it = itemById(itemId);
      if (st.gold < it.price) { st.notify('Not enough gold.'); return; }
      set({ gold: st.gold - it.price, inventory: [...st.inventory, itemId] });
      autoSave();
    },

    hireStock: (jobId) => {
      const st = get();
      if (st.gold < 250) { st.notify('Hiring costs 250G.'); return; }
      if (st.party.length + st.reserves.length >= 12) { st.notify('Roster is full (12).'); return; }
      const idx = (st.party.length + st.reserves.length + Math.floor(Math.random() * 997)) % STOCK_NAMES.length;
      const lvl = Math.max(1, st.party[0]?.level ?? 1);
      const c = mkChar({
        id: 'stock-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
        name: STOCK_NAMES[idx], icon: STOCK_ICONS[Math.floor(Math.random() * STOCK_ICONS.length)],
        color: STOCK_COLORS[Math.floor(Math.random() * STOCK_COLORS.length)],
        level: lvl, jobId, jp: { [jobId]: 100 }, jpEarned: { [jobId]: 100 }, learned: [],
        equip: { weapon: null, helmet: null, armor: null, shield: null, accessory: null },
      });
      const starter: Record<string, string> = { drifter: 'w-rusty', 'carbon-knight': 'w-trench', lancer: 'w-pitch', gunner: 'w-snub', rifleman: 'w-varmint', deadeye: 'w-squirrel', 'flash-adept': 'w-spark', synthesist: 'w-wrench', surgeon: 'w-wrench', warden: 'w-varmint' };
      if (starter[jobId]) c.equip.weapon = starter[jobId];
      c.hp = baseStats(c).maxHp;
      if (st.party.length < 6) set({ party: [...st.party, c], gold: st.gold - 250 });
      else set({ reserves: [...st.reserves, c], gold: st.gold - 250 });
      st.notify(`${c.name} hired as ${jobById(jobId).name}.`);
      autoSave();
    },

    dismissToReserve: (charId) => {
      const st = get();
      const c = st.party.find(p => p.id === charId);
      if (!c || st.party.length <= 1) return;
      if (['rye', 'june', 'echo'].includes(charId)) { st.notify('Major characters cannot leave the party.'); return; }
      set({ party: st.party.filter(p => p.id !== charId), reserves: [...st.reserves, c] });
      autoSave();
    },
    promoteReserve: (charId) => {
      const st = get();
      const c = st.reserves.find(p => p.id === charId);
      if (!c || st.party.length >= 6) return;
      set({ reserves: st.reserves.filter(p => p.id !== charId), party: [...st.party, c] });
      autoSave();
    },

    addLog: (m) => set({ log: [...get().log.slice(-40), m] }),
  };
});

export function reachableNodes(visited: string[], currentNode: string): string[] {
  if (visited.length === 0) return ['walsenburg'];
  const set = new Set<string>();
  for (const v of visited) for (const n of neighborsOf(v)) set.add(n.id);
  set.add(currentNode);
  for (const n of neighborsOf(currentNode)) set.add(n.id);
  return [...set];
}

export function questTarget(storyIndex: number): string | null {
  return MAIN_QUEST[storyIndex] ?? null;
}
