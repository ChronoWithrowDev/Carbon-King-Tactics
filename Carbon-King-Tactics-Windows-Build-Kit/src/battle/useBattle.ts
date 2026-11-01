import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useGame } from '../game/store';
import { nodeById } from '../game/world';
import { genMap, SIZE } from '../game/terrain';
import type { JobAbility } from '../game/jobs';
import { calculateBattleRewards } from '../game/rewards';
import { manhattan } from '../lib/rng';
import type { AbilitySound } from '../lib/sound';
import type { BattleScene, HiCell, HiKind } from './BattleScene';
import { createBattleUnits } from './units';
import { applyDamage, counterDamage, dmgCalc, effDef, enemyDamage, strikeDamage, weakHit } from './combat';
import { computeReach, destinations, pathTo, ringTiles, chooseEnemyMove, type PathCtx, type Reach } from './pathing';
import { tkey, parseKey, type BU, type Floater, type Panel, type Phase } from './types';

/**
 * All battle state + rules: turn order, player actions, abilities, enemy AI, win/lose.
 * The hook never touches three.js directly; it drives the BattleScene through a handful of calls.
 * State read inside timers goes through refs, so mid-turn state updates can never cancel a pending turn (the old hang).
 */
export function useBattle(sceneRef: MutableRefObject<BattleScene | null>) {
  const g = useGame();
  const [init] = useState(() => {
    const st = useGame.getState();
    const nodeId = st.pendingNode ?? st.currentNode;
    const node = nodeById(nodeId);
    return { nodeId, node, bmap: genMap(node, st.battlesWon) };
  });
  const { node, nodeId, bmap } = init;
  const { heights, blocked, theme } = bmap;

  const [units, setUnits] = useState<BU[]>(() => { const st = useGame.getState(); return createBattleUnits(st.party, node, st.storyIndex, st.battlesWon); });
  const [order, setOrder] = useState<string[]>(() => [...units].sort((a, b) => b.spd - a.spd).map(u => u.uid));
  const [turnPos, setTurnPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('fight');
  const [selAction, setSelAction] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('main');
  const [reach, setReach] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>(() => [`Contact at ${node.name} (Lv ${node.level}). Terrain: ${theme.label}.`]);
  const [flashPlay, setFlashPlay] = useState<{ ability: string; user: string; run: () => void } | null>(null);
  const [artyLeft, setArtyLeft] = useState(2);
  const [walls, setWalls] = useState<{ x: number; z: number; until: number }[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);

  const round = Math.floor(turnPos / Math.max(1, order.length)) + 1;
  const activeUid = order[turnPos % order.length];
  const active = units.find(u => u.uid === activeUid);
  const alivePlayers = units.filter(u => u.team === 'player' && u.alive);
  const aliveEnemies = units.filter(u => u.team === 'enemy' && u.alive);

  const unitsRef = useRef(units); unitsRef.current = units;
  const orderRef = useRef(order); orderRef.current = order;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const wallsRef = useRef(walls); wallsRef.current = walls;
  const roundRef = useRef(round); roundRef.current = round;
  const activeUidRef = useRef(activeUid); activeUidRef.current = activeUid;
  const busyRef = useRef(false);
  const reachMap = useRef<Reach | null>(null);
  const fid = useRef(0);

  const pushLog = (m: string) => setLog(l => [...l.slice(-40), m]);
  const isBlocked = (x: number, z: number) => blocked[x][z] || wallsRef.current.some(w => w.x === x && w.z === z);
  const occAt = (x: number, z: number, list?: BU[]) => (list ?? unitsRef.current).find(u => u.alive && u.x === x && u.z === z);
  const deadAt = (x: number, z: number) => unitsRef.current.find(u => !u.alive && u.team === 'player' && u.x === x && u.z === z && u.moteLife === undefined);
  const ctx: PathCtx = { heights, isBlocked, occAt: (x, z) => occAt(x, z) };
  const timersRef = useRef<Set<number>>(new Set());
  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); timersRef.current.clear(); }, []);

  const float = (x: number, z: number, text: string, color = '#fff') => {
    const p = sceneRef.current?.project(x, z, 2.1);
    if (!p) return;
    const id = ++fid.current;
    setFloaters(f => [...f.slice(-14), { id, x: p.x, y: p.y, text, color }]);
    later(1150, () => setFloaters(f => f.filter(q => q.id !== id)));
  };
  const dealDamage = (uid: string, raw: number) => setUnits(us => us.map(u => (u.uid === uid ? applyDamage(u, raw) : u)));
  const impact = (a: BU, t: BU, dmg: number, color: string, heavyHit = false) => {
    const blocked = t.shield > 0 || (t.hasShield && t.defUp > 0);
    const lethal = dmg >= t.hp + t.shield;
    float(t.x, t.z, blocked && t.shield >= dmg ? `BLOCK -${dmg}` : `-${dmg}`, blocked && t.shield >= dmg ? '#7dd3fc' : color);
    sceneRef.current?.hit(t.uid, a.x, a.z, { blocked, heavy: heavyHit || lethal, attackerUid: a.uid });
    dealDamage(t.uid, dmg);
  };
  const maybeCounter = (t: BU, a: BU, dmg: number, all: BU[]) => {
    const survived = t.hp - Math.max(0, dmg - t.shield) > 0;
    if (!survived || !t.passive.includes('counter') || manhattan(t.x, t.z, a.x, a.z) > 1 || Math.random() > 0.5) return;
    const cd = counterDamage(t, a, all);
    sceneRef.current?.attack(t.uid, t.wType, a.x, a.z);
    later(300, () => { impact(t, a, cd, '#fb923c'); pushLog(`${t.name} counters for ${cd}.`); });
  };

  /* ---------- scene sync ---------- */
  const abKind = (ab?: JobAbility): HiKind => (ab?.targetType === 'enemy' ? 'attack' : ab?.targetType === 'ally' ? 'ally' : 'move');
  const refreshHighlights = () => {
    const s = sceneRef.current; if (!s) return;
    const ab = active?.abilities.find(a => 'ab:' + a.id === selAction);
    const kind: HiKind = selAction === 'attack' || selAction === 'arty' || selAction === 'air' ? 'attack' : selAction?.startsWith('ab:') ? abKind(ab) : 'move';
    const cells: HiCell[] = reach.map(k => { const [x, z] = parseKey(k); return { x, z, k: kind }; });
    s.setHighlights(cells, active && phase === 'fight' ? { x: active.x, z: active.z } : null);
  };
  const syncNow = () => {
    sceneRef.current?.syncUnits(unitsRef.current, activeUidRef.current, phaseRef.current === 'victory');
    sceneRef.current?.setWalls(wallsRef.current);
    refreshHighlights();
  };
  useEffect(() => { sceneRef.current?.syncUnits(units, activeUid, phase === 'victory'); }, [units, activeUid, phase]);
  useEffect(() => { sceneRef.current?.setWalls(walls); }, [walls]);
  useEffect(refreshHighlights, [reach, selAction, activeUid, active?.x, active?.z, phase]);

  /* ---------- turn flow ---------- */
  const nextTurn = () => {
    busyRef.current = false; setTurnPos(p => p + 1); setSelAction(null); setReach([]); setPanel('main'); };
  const endTurn = (uid: string) => {
    setUnits(us => us.map(u => {
      if (u.uid !== uid) return u;
      const moteLife = u.moteLife !== undefined ? u.moteLife - 1 : undefined;
      const atkUp = Math.max(0, u.atkUp - 1);
      return {
        ...u, atkUp, tempAtk: atkUp === 0 ? 0 : u.tempAtk, defUp: Math.max(0, u.defUp - 1), defDown: Math.max(0, u.defDown - 1),
        marked: Math.max(0, u.marked - 1), slow: 0, suit: Math.max(0, u.suit - 1),
        tauntTurns: Math.max(0, u.tauntTurns - 1), tauntUid: u.tauntTurns - 1 <= 0 ? null : u.tauntUid,
        moteLife, alive: moteLife !== undefined && moteLife <= 0 ? false : u.alive && u.hp > 0,
        acted: false, moved: false,   // fresh economy for the next turn
      };
    }));
    nextTurn();
  };

  /** Spends the unit's action. The turn only ends once the move is also spent (or on WAIT / END TURN). */
  const finishAction = (uid: string, wait = 600) => {
    setUnits(us => us.map(u => (u.uid === uid ? { ...u, acted: true } : u)));
    setSelAction(null); setReach([]); setPanel('main');
    later(wait, () => {
      const u = unitsRef.current.find(x => x.uid === uid);
      // a unit that died during its own action (e.g. a counterattack) must not keep the turn
      if (!u || !u.alive || u.moved) endTurn(uid);
      else busyRef.current = false;   // still has a move to make: hand control back
    });
  };

  const lastRound = useRef(1);
  useEffect(() => {
    if (round === lastRound.current) return;
    lastRound.current = round;
    setUnits(us => us.map(u => (u.team === 'player' && u.alive ? { ...u, flash: Math.min(2, u.flash + 1) } : u)));
    setWalls(w => w.filter(x => x.until > round));
    pushLog(`Round ${round} — flash charges cycle up.`);
  }, [round]);

  /* ---------- player actions ---------- */
  const doBasicAttack = (auid: string, tuid: string) => {
    busyRef.current = true;
    const a0 = unitsRef.current.find(u => u.uid === auid)!, t0 = unitsRef.current.find(u => u.uid === tuid)!;
    setSelAction(null); setReach([]);
    const delay = sceneRef.current?.attack(auid, a0.wType, t0.x, t0.z) ?? 200;
    later(delay, () => {
      const all = unitsRef.current;
      const a = all.find(u => u.uid === auid), t = all.find(u => u.uid === tuid);
      if (!a || !t) { endTurn(auid); return; }
      const dmg = dmgCalc(heights, roundRef.current, a, t, 1, a.atk, false, all);
      const wk = weakHit(a, t, false);
      impact(a, t, dmg, wk ? '#facc15' : '#ffffff', wk);
      pushLog(`${a.name} hits ${t.name} with ${a.wName} for ${dmg}${wk ? ' (WEAKNESS)' : ''}.`);
      if (a.steady) setUnits(us => us.map(u => (u.uid === auid ? { ...u, steady: false } : u)));
      maybeCounter(t, a, dmg, all);
      finishAction(auid, 520);
    });
  };

  const doStrike = (auid: string, tx: number, tz: number, air: boolean) => {
    if (artyLeft <= 0) { pushLog('No fire missions left.'); return; }
    busyRef.current = true;
    const a = unitsRef.current.find(u => u.uid === auid)!;
    setArtyLeft(v => v - 1);
    setSelAction(null); setReach([]); setPanel('main');
    float(tx, tz, air ? 'AIRSTRIKE' : 'INCOMING', '#f87171');
    pushLog(`${a.name} calls ${air ? 'AIRSTRIKE from DIA' : 'ARTILLERY from the battery'} on [${tx},${tz}].`);
    const delay = sceneRef.current?.strike(tx, tz, air) ?? 600;
    later(delay, () => {
      const all = unitsRef.current, r = air ? 1 : 2;
      for (const u of all) {
        if (u.team !== 'enemy' || !u.alive || manhattan(u.x, u.z, tx, tz) > r) continue;
        impact(a, u, strikeDamage(a, u, all, air), '#fb923c');
      }
      pushLog('Fire for effect.');
      finishAction(auid, 700);
    });
  };

  const doAbility = (auid: string, ab: JobAbility, tx: number, tz: number) => {
    const a0 = unitsRef.current.find(u => u.uid === auid)!;
    if (manhattan(a0.x, a0.z, tx, tz) > ab.range && ab.targetType !== 'self') { pushLog('Out of range.'); return; }
    const fail = (m: string) => { pushLog(m); busyRef.current = false; };

    const exec = () => {
      busyRef.current = true;
      const all = unitsRef.current;
      const a = all.find(u => u.uid === auid)!;
      if (ab.flash && a.flash <= 0) { fail('No flash charges left.'); return; }
      const eff = ab.effect ?? '';
      const done = (wait = 650) => {
        if (ab.flash) setUnits(us => us.map(u => (u.uid === auid ? { ...u, flash: Math.max(0, u.flash - 1) } : u)));
        finishAction(auid, wait);
      };
      const s = sceneRef.current;
      const support = ['heal', 'revive', 'scan', 'shield', 'synthWeapon', 'suit', 'summon', 'wall', 'teleport', 'mark', 'taunt', 'atkUp', 'haste', 'defUp', 'steady', 'stim', 'cleanse', 'extraTurn'].includes(eff);
      const audio: AbilitySound = ab.flash
        ? 'flash'
        : ['heal', 'revive', 'stim', 'cleanse'].includes(eff)
          ? 'heal'
          : ['synthWeapon', 'suit', 'summon', 'wall', 'shield'].includes(eff)
            ? 'synth'
            : ['scan', 'mark', 'taunt', 'steady'].includes(eff)
              ? 'scan'
              : ['teleport', 'extraTurn'].includes(eff)
                ? 'warp'
                : 'buff';
      if (support) s?.cast(auid, ab.flash ? 0x22d3ee : 0x5cf08a, audio);

      if (eff === 'heal') {
        const amt = Math.round((ab.power + a.mag * 1.2) * (a.passive.includes('healUp') ? 1.3 : 1));
        if (ab.aoe >= 5) {
          const ally = all.filter(u => u.team === 'player' && u.alive && manhattan(u.x, u.z, a.x, a.z) <= 5);
          setUnits(us => us.map(u => (ally.some(v => v.uid === u.uid) ? { ...u, hp: Math.min(u.maxHp, u.hp + amt) } : u)));
          ally.forEach(u => s?.healFx(u.x, u.z));
          float(a.x, a.z, `+${amt} ALL`, '#4ade80'); pushLog(`${a.name} — ${ab.name}: mass mend +${amt}.`);
        } else {
          const t = occAt(tx, tz, all);
          if (!t || t.team !== 'player') { fail('Needs a living ally.'); return; }
          setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, hp: Math.min(u.maxHp, u.hp + amt) } : u)));
          s?.healFx(t.x, t.z); float(t.x, t.z, `+${amt}`, '#4ade80'); pushLog(`${a.name} heals ${t.name} +${amt}.`);
        }
        done(); return;
      }
      if (eff === 'revive') {
        const t = deadAt(tx, tz);
        if (!t) { fail('No downed ally there — click a grave marker.'); return; }
        setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, alive: true, hp: Math.round(u.maxHp * 0.5) } : u)));
        float(tx, tz, 'REVIVED', '#4ade80'); pushLog(`${a.name} cold-restarts ${t.name}.`);
        done(); return;
      }
      if (eff === 'scan') {
        setUnits(us => us.map(u => (u.team === 'enemy' ? { ...u, scanned: true } : u)));
        float(a.x, a.z, 'SCANNED', '#22d3ee'); pushLog(`${a.name} Deep Scans: enemy HP + weaknesses revealed.`);
        done(); return;
      }
      if (eff === 'shield' || eff === 'suit') {
        const t = occAt(tx, tz, all), tgt = t && t.team === 'player' ? t : a;
        setUnits(us => us.map(u => (u.uid === tgt.uid ? (eff === 'shield' ? { ...u, shield: 60 } : { ...u, suit: 3, shield: u.shield + 30 }) : u)));
        s?.buffFx(tgt.x, tgt.z, eff === 'shield' ? 0x93c5fd : 0xe879f9);
        float(tgt.x, tgt.z, eff === 'shield' ? 'AEGIS 60' : 'HULL SUIT', eff === 'shield' ? '#93c5fd' : '#e879f9');
        pushLog(eff === 'shield' ? `${a.name} shields ${tgt.name}.` : `${tgt.name} sealed in a synth Hull Suit.`);
        done(); return;
      }
      if (eff === 'synthWeapon') {
        setUnits(us => us.map(u => (u.uid === auid ? { ...u, atkUp: 3, tempAtk: 8 } : u)));
        float(a.x, a.z, 'SYNTH +8', '#facc15'); pushLog(`${a.name} synthesizes a humming blade (+8 ATK, 3 turns).`);
        done(); return;
      }
      if (eff === 'summon') {
        if (occAt(tx, tz, all) || isBlocked(tx, tz)) { fail('Tile occupied or blocked.'); return; }
        const fork = a.name.includes('Echo');
        const mote: BU = {
          uid: 'mote-' + Date.now(), name: fork ? 'Echo Fork' : 'Synth Mote', icon: fork ? 'orbit' : 'sparkles', color: '#4ade80', team: 'player',
          jobId: 'synthesist', level: a.level, hp: 30 + a.level * 4, maxHp: 30 + a.level * 4, atk: a.atk, def: a.def, spd: a.spd + 1, mag: a.mag,
          move: 4, jump: 3, jobName: 'Summon', wType: 'Mace', wRange: [1, 2], wName: 'Lattice Claw', wAtk: 5 + a.level,
          hasShield: false, passive: [], abilities: [], x: tx, z: tz, alive: true,
          atkUp: 0, defUp: 0, defDown: 0, shield: 0, suit: 0, tempAtk: 0, steady: false, marked: 0, slow: 0, tauntUid: null, tauntTurns: 0,
          weak: '—', scanned: true, flash: 0, moteLife: 3, gutsUsed: false, acted: false, moved: false,
        };
        setUnits(us => [...us, mote]); setOrder(o => [...o, mote.uid]);
        float(tx, tz, 'SUMMONED', '#4ade80'); pushLog(`${a.name} synthesizes ${mote.name} (3 turns).`);
        done(); return;
      }
      if (eff === 'wall') {
        if (occAt(tx, tz, all) || isBlocked(tx, tz)) { fail('Cannot raise a wall there.'); return; }
        setWalls(w => [...w, { x: tx, z: tz, until: roundRef.current + 3 }]);
        float(tx, tz, 'WALL', '#67e8f9'); pushLog(`${a.name} raises a synth wall (blocks 3 rounds).`);
        done(); return;
      }
      if (eff === 'teleport') {
        if (occAt(tx, tz, all) || isBlocked(tx, tz)) { fail('Nowhere to skip to.'); return; }
        setUnits(us => us.map(u => (u.uid === auid ? { ...u, x: tx, z: tz } : u)));   // no queued path -> rig snaps with sparks
        float(tx, tz, 'SKIP', '#93c5fd'); pushLog(`${a.name} skip-traces across the lattice.`);
        done(); return;
      }
      if (eff === 'mark') {
        const t = occAt(tx, tz, all);
        if (!t || t.team !== 'enemy') { fail('Needs an enemy.'); return; }
        setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, marked: 2 } : u)));
        s?.buffFx(t.x, t.z, 0xf87171); float(t.x, t.z, 'MARKED', '#f87171'); pushLog(`${a.name} marks ${t.name} (+30% damage taken).`);
        done(); return;
      }
      if (eff === 'taunt') {
        setUnits(us => us.map(u => (u.team === 'enemy' && u.alive && manhattan(u.x, u.z, tx, tz) <= Math.max(1, ab.aoe) ? { ...u, tauntUid: auid, tauntTurns: 2 } : u)));
        float(tx, tz, 'TAUNTED', '#fbbf24'); pushLog(`${a.name} taunts the area.`);
        done(); return;
      }
      if (eff === 'atkUp' || eff === 'haste') {
        setUnits(us => us.map(u => (u.uid === auid || (ab.aoe > 0 && u.team === 'player' && u.alive && manhattan(u.x, u.z, a.x, a.z) <= ab.aoe) ? { ...u, atkUp: 2 } : u)));
        s?.buffFx(a.x, a.z); float(a.x, a.z, 'BUFFED', '#facc15'); pushLog(`${a.name} — ${ab.name}.`);
        done(); return;
      }
      if (eff === 'defUp') {
        setUnits(us => us.map(u => (u.uid === auid ? { ...u, defUp: 2 } : u)));
        s?.buffFx(a.x, a.z, 0x60a5fa); float(a.x, a.z, 'GUARD', '#60a5fa'); pushLog(`${a.name} braces.`);
        done(); return;
      }
      if (eff === 'steady') {
        setUnits(us => us.map(u => (u.uid === auid ? { ...u, steady: true } : u)));
        float(a.x, a.z, 'STEADY', '#a78bfa'); pushLog(`${a.name} steadies breathing (+50% next shot).`);
        done(); return;
      }
      if (eff === 'stim') {
        const t = occAt(tx, tz, all);
        if (!t || t.team !== 'player') { fail('Needs an ally.'); return; }
        setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, hp: Math.min(u.maxHp, u.hp + 25), atkUp: 1 } : u)));
        s?.healFx(t.x, t.z); float(t.x, t.z, '+25 STIM', '#4ade80'); pushLog(`${a.name} stims ${t.name}.`);
        done(); return;
      }
      if (eff === 'cleanse') {
        setUnits(us => us.map(u => (u.team === 'player' && u.alive && manhattan(u.x, u.z, tx, tz) <= Math.max(0, ab.aoe) ? { ...u, slow: 0, defDown: 0, hp: Math.min(u.maxHp, u.hp + 25) } : u)));
        s?.healFx(tx, tz); float(tx, tz, 'CLEANSED', '#4ade80'); pushLog(`${a.name} purges static.`);
        done(); return;
      }
      if (eff === 'extraTurn') {
        float(a.x, a.z, 'AGAIN', '#c084fc'); pushLog(`${a.name} loops time — acts again.`);
        busyRef.current = false; setSelAction(null); setReach([]); setPanel('main');
        return;
      }
      if (eff === 'artillery' || eff === 'airstrike') {
        const air = eff === 'airstrike', st = useGame.getState();
        if (air && !st.hasAirstrike) { fail('Airstrike not unlocked (capture DIA).'); return; }
        if (!air && !st.hasArtillery) { fail('Artillery not unlocked (capture a base).'); return; }
        if (artyLeft <= 0) { fail('No fire missions left.'); return; }
        busyRef.current = false;
        doStrike(auid, tx, tz, air);
        return;
      }

      // damaging abilities
      let targets = all.filter(u => u.team === 'enemy' && u.alive && manhattan(u.x, u.z, tx, tz) <= ab.aoe && (ab.aoe > 0 || (u.x === tx && u.z === tz)));
      if (eff === 'line') {
        const dx = Math.sign(tx - a.x), dz = Math.sign(tz - a.z), line: BU[] = [];
        for (let i = 1; i <= 3; i++) {
          const lx = a.x + dx * i, lz = a.z + dz * i;
          if (lx < 0 || lz < 0 || lx >= SIZE || lz >= SIZE) break;
          const o = occAt(lx, lz, all);
          if (o && o.team === 'enemy') line.push(o);
        }
        targets = line;
      }
      if (!targets.length) { fail('No target.'); return; }
      const isLeap = eff === 'leap' || ab.id === 'd-rush';
      const delay = isLeap
        ? (s?.leapAttack(auid, targets[0].x, targets[0].z, eff === 'leap' ? 0x5cf0c8 : 0xffe28a) ?? 420)
        : (s?.attack(auid, ab.flash ? 'DEW' : a.wType, targets[0].x, targets[0].z) ?? 200);
      const hits = eff === 'double' ? 2 : 1;
      later(delay, () => {
        const fresh = unitsRef.current;
        const me = fresh.find(u => u.uid === auid) ?? a;
        targets.forEach((t0, idx) => {
          const t = fresh.find(u => u.uid === t0.uid);
          if (!t || !t.alive) return;
          if (idx > 0) s?.aoeHitFx(me.x, me.z, t.x, t.z, !!ab.flash);
          for (let h = 0; h < hits; h++) {
            const leap = eff === 'leap' ? Math.max(0, heights[me.x][me.z] - heights[t.x][t.z]) * 4 : 0;
            const dmg = dmgCalc(heights, roundRef.current, me, t, ab.power || 1, ab.flash ? me.mag + me.wAtk * 0.3 : me.atk, !!ab.flash, fresh) + leap;
            const wk = weakHit(me, t, !!ab.flash);
            impact(me, t, dmg, wk ? '#facc15' : ab.flash ? '#22d3ee' : '#ffffff', wk || isLeap || (ab.power ?? 1) >= 1.6);
            pushLog(`${me.name} — ${ab.name} hits ${t.name} for ${dmg}.`);
            if (eff === 'slow') setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, slow: 1 } : u)));
            if (eff === 'defDown') setUnits(us => us.map(u => (u.uid === t.uid ? { ...u, defDown: 2 } : u)));
            if (manhattan(me.x, me.z, t.x, t.z) <= 1) maybeCounter(t, me, dmg, fresh);
          }
        });
        done(500);
      });
    };
    if (ab.flash) setFlashPlay({ ability: ab.name, user: a0.name, run: exec });
    else exec();
  };

  const handleTileRef = useRef<(x: number, z: number) => void>(() => {});
  handleTileRef.current = (x, z) => {
    if (phase !== 'fight' || busyRef.current || flashPlay || !active || active.team !== 'player') return;
    const key = tkey(x, z);
    if (selAction === 'move') {
      if (!reach.includes(key) || !reachMap.current) return;
      const path = pathTo(reachMap.current, key);
      sceneRef.current?.queueMove(active.uid, path);
      setUnits(us => us.map(u => (u.uid === active.uid ? { ...u, x, z, moved: true } : u)));
      pushLog(`${active.name} moves to [${x},${z}].`);
      setSelAction(null); setReach([]);
      if (active.acted) {                    // action already spent: this move completes the turn after the walk
        busyRef.current = true;
        later(path.length * 260 + 260, () => endTurn(active.uid));
      }
    } else if (selAction === 'attack') {
      const t = occAt(x, z);
      if (!t || t.team !== 'enemy') { pushLog('No hostile there.'); return; }
      const d = manhattan(active.x, active.z, x, z);
      if (d < active.wRange[0] || d > active.wRange[1]) { pushLog('Out of range.'); return; }
      doBasicAttack(active.uid, t.uid);
    } else if (selAction?.startsWith('ab:')) {
      const ab = active.abilities.find(a => 'ab:' + a.id === selAction);
      if (ab) doAbility(active.uid, ab, x, z);
    } else if (selAction === 'arty' || selAction === 'air') doStrike(active.uid, x, z, selAction === 'air');
  };

  /* ---------- enemy AI ---------- */
  const runOverwatch = (uid: string) => {
    const enemy = unitsRef.current.find(v => v.uid === uid);
    if (!enemy || !enemy.alive) return;
    for (const ow of unitsRef.current.filter(v => v.team === 'player' && v.alive && v.passive.includes('overwatch'))) {
      const d = manhattan(ow.x, ow.z, enemy.x, enemy.z);
      if (d < ow.wRange[0] || d > ow.wRange[1]) continue;
      const od = Math.max(1, Math.round((ow.atk + ow.wAtk) * 0.8 - effDef(enemy, unitsRef.current) * 0.5));
      sceneRef.current?.attack(ow.uid, ow.wType, enemy.x, enemy.z);
      later(180, () => { impact(ow, enemy, od, '#fbbf24'); pushLog(`${ow.name} overwatch hits ${enemy.name} for ${od}.`); });
    }
  };

  const runEnemyAI = (uid: string) => {
    if (phaseRef.current !== 'fight') return;
    const all = unitsRef.current, u = all.find(v => v.uid === uid);
    if (!u || !u.alive) { nextTurn(); return; }
    const plan = chooseEnemyMove(ctx, u, all.filter(v => v.team === 'player' && v.alive));
    if (!plan) { nextTurn(); return; }
    const moved = plan.path.length > 0;
    if (moved) {
      sceneRef.current?.queueMove(uid, plan.path);
      setUnits(us => us.map(v => (v.uid === uid ? { ...v, x: plan.dest.x, z: plan.dest.z } : v)));
      pushLog(`${u.name} advances.`);
    }
    later(moved ? plan.path.length * 240 + 220 : 260, () => {
      if (phaseRef.current !== 'fight') return;
      const me = unitsRef.current.find(v => v.uid === uid);
      if (!me || !me.alive) { nextTurn(); return; }
      const foes = unitsRef.current.filter(v => v.team === 'player' && v.alive && manhattan(me.x, me.z, v.x, v.z) >= me.wRange[0] && manhattan(me.x, me.z, v.x, v.z) <= me.wRange[1]);
      if (!foes.length) { pushLog(`${me.name} holds (no shot).`); runOverwatch(uid); later(500, () => endTurn(uid)); return; }
      let victim = foes.find(v => v.uid === me.tauntUid) ?? foes[0];
      if (victim.uid !== me.tauntUid) for (const v of foes) if (v.hp < victim.hp) victim = v;
      const delay = sceneRef.current?.attack(uid, me.wType, victim.x, victim.z) ?? 200;
      later(delay, () => {
        const fresh = unitsRef.current;
        const m = fresh.find(v => v.uid === uid), v = fresh.find(x => x.uid === victim.uid);
        if (m && m.alive && v && v.alive) {
          const dmg = enemyDamage(heights, m, v, fresh);
          impact(m, v, dmg, '#f87171');
          pushLog(`${m.name} hits ${v.name} for ${dmg}.`);
          maybeCounter(v, m, dmg, fresh);
        }
        runOverwatch(uid);
        later(550, () => endTurn(uid));
      });
    });
  };

  // turn driver: depends ONLY on turnPos/phase/order; everything else is read through refs
  useEffect(() => {
    if (phase !== 'fight') return;
    const uid = orderRef.current[turnPos % orderRef.current.length];
    const u = unitsRef.current.find(x => x.uid === uid);
    if (!u) { const t = window.setTimeout(nextTurn, 120); return () => clearTimeout(t); }
    if (!u.alive) { const t = window.setTimeout(nextTurn, 200); return () => clearTimeout(t); }
    if (u.team === 'enemy') { const t = window.setTimeout(() => runEnemyAI(uid), 650); return () => clearTimeout(t); }
  }, [turnPos, phase, order]);

  useEffect(() => {
    if (phase !== 'fight' || units.length === 0) return;
    if (aliveEnemies.length === 0) { setPhase('victory'); pushLog('All hostiles down.'); }
    else if (alivePlayers.length === 0) setPhase('defeat');
  }, [units]);

  /* ---------- UI actions ---------- */
  const selectMove = () => { if (!active || busyRef.current || active.moved) return; const r = computeReach(ctx, active); reachMap.current = r; setSelAction('move'); setReach(destinations(ctx, r)); setPanel('main'); };
  const selectAttack = () => { if (!active || busyRef.current || active.acted) return; setSelAction('attack'); setReach(ringTiles(active, active.wRange[0], active.wRange[1])); setPanel('main'); };
  const selectAbility = (ab: JobAbility) => { if (!active || busyRef.current || active.acted) return; setSelAction('ab:' + ab.id); setReach(ab.targetType === 'self' ? [tkey(active.x, active.z)] : ringTiles(active, 0, ab.range)); };
  const selectFire = (kind: 'arty' | 'air') => { if (!active || busyRef.current || active.acted) return; setSelAction(kind); setReach(ringTiles(active, 0, 9)); };
  const wait = () => { if (!active || busyRef.current || phase !== 'fight') return; busyRef.current = true; later(60, () => endTurn(active.uid)); };
  const back = () => { setPanel('main'); setSelAction(null); setReach([]); };

  const hasScavenge = g.party.some(p => p.learned.includes('d-scavenge'));
  const rewards = calculateBattleRewards(node.level, alivePlayers.length, hasScavenge);
  const claimVictory = () => {
    const hpMap = new Map(units.filter(u => u.charId).map(u => [u.charId!, Math.max(0, u.hp)]));
    useGame.setState(s => ({ party: s.party.map(p => ({ ...p, hp: hpMap.has(p.id) ? hpMap.get(p.id)! : p.hp })) }));
    g.winBattle(rewards.xp, rewards.jp, rewards.gold);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'fight' || !active || active.team !== 'player' || flashPlay) return;
      if (e.key === 'Escape') { back(); return; }
      if (busyRef.current) return;
      const k = e.key.toLowerCase();
      if (k === 'm') selectMove();
      else if (k === 'a') selectAttack();
      else if (k === 's') setPanel(p => (p === 'skills' ? 'main' : 'skills'));
      else if (k === 'f' && (g.hasArtillery || g.hasAirstrike)) setPanel('fire');
      else if (k === 'w') wait();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finishFlash = () => {
    const run = flashPlay?.run;
    setFlashPlay(null);
    if (run) later(30, run);
  };

  const hoverUnit = hover ? units.find(u => u.alive && u.x === hover.x && u.z === hover.z) : undefined;

  return {
    g, node, nodeId, bmap, theme, units, order, turnPos, round, phase, active, selAction, panel, setPanel, log,
    flashPlay, finishFlash, artyLeft, floaters, setHover, hoverUnit, rewards, hasScavenge,
    tileRef: handleTileRef, syncNow, selectMove, selectAttack, selectAbility, selectFire, wait, back, claimVictory,
    isPlayerTurn: !!active && active.team === 'player' && phase === 'fight',
    selAbility: active && selAction?.startsWith('ab:') ? active.abilities.find(a => 'ab:' + a.id === selAction) : undefined,
  };
}
