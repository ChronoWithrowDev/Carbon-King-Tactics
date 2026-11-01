import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/store';
import { nodeById } from '../game/world';
import { genMap } from '../game/terrain';
import { createStageKit } from '../three/stage';
import { CAST, spawnCast, animateCast } from '../three/cinematic';
import GIcon from '../ui/GameIcon';
import { clamp } from '../lib/rng';
import FullscreenButton from '../ui/Fullscreen';
import AudioButton from '../ui/AudioButton';
import { sound } from '../lib/sound';

/** Story scenes play on the real battle map of the node, with the same character models. Dialogue docks at the bottom. */
export default function StoryScreen() {
  const { storyLines, storyTitle, storyChapter, advanceStory, finishStory, pendingNode, currentNode } = useGame();
  const mountRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const speakerRef = useRef('');

  const nodeId = pendingNode ?? currentNode;
  const node = nodeById(nodeId);
  const line = storyLines[0];
  speakerRef.current = line?.who ?? '';

  useEffect(() => {
    if (textRef.current) textRef.current.scrollTop = 0;
    if (line) {
      sound.speakDialogue(line.who, line.text);
    }
    return () => {
      sound.stopVoice();
    };
  }, [line]);

  useEffect(() => {
    const el = mountRef.current!;
    const st = useGame.getState();
    const bmap = genMap(nodeById(nodeId), st.battlesWon);
    const kit = createStageKit(el, bmap, nodeId);
    const whos = [...new Set(st.storyLines.map(l => l.who))];
    for (const core of ['RYE', 'JUNE', 'SEVEN']) if (whos.length < 4 && !whos.includes(core)) whos.push(core);
    const cast = spawnCast(kit, bmap, whos, 'story');
    const v3 = new THREE.Vector3();

    kit.setFrame((t, dt, now) => {
      const th = Math.sin(t * 0.1) * 0.12, R = 8.8;
      kit.camera.position.set(Math.sin(th) * R, 4.3 + Math.sin(t * 0.2) * 0.1, Math.cos(th) * R + 1);
      kit.camera.lookAt(0, 0.8, 0.8);
      animateCast(cast, t, dt, now, speakerRef.current, kit.camera);

      // speech-bubble pointer: only the tail follows the speaker; the panel stays docked
      const bub = bubbleRef.current, tail = tailRef.current, spk = cast.get(speakerRef.current);
      if (!bub || !tail || !spk) { if (tail) tail.style.opacity = '0'; return; }
      const stage = el.getBoundingClientRect(), panel = bub.getBoundingClientRect();
      const pl = panel.left - stage.left, pt = panel.top - stage.top;
      v3.set(spk.rig.root.position.x, spk.rig.root.position.y + 1.75, spk.rig.root.position.z).project(kit.camera);
      const sx = clamp((v3.x * 0.5 + 0.5) * stage.width, 12, stage.width - 12);
      const sy = clamp((-v3.y * 0.5 + 0.5) * stage.height, 12, pt - 16);
      const bx = clamp(sx, pl + 32, pl + panel.width - 32), by = pt + 2;
      const dx = sx - bx, dy = sy - by, len = Math.min(1, 72 / Math.max(1, Math.hypot(dx, dy)));
      tail.setAttribute('d', `M ${bx - 12} ${by} L ${bx + dx * len} ${by + dy * len} L ${bx + 12} ${by}`);
      tail.style.opacity = v3.z >= -1 && v3.z <= 1 ? '1' : '0';
    });
    return () => kit.dispose();
  }, [nodeId]);

  if (!line) return null;
  const meta = CAST[line.who] ?? { color: '#94a3b8', icon: 'user' };
  const choir = line.who === 'CHOIR';

  return (
    <div className="story-scene absolute inset-0 z-40 bg-[#05080f]">
      <div ref={mountRef} className="absolute inset-0 cursor-pointer" onClick={advanceStory} />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-center p-2.5">
        <div className="glass px-5 py-1.5 text-center">
          <div className="hud-label !text-teal-300">{storyChapter}</div>
          <div className="text-[15px] font-black tracking-tight">{storyTitle}</div>
          <div className="hud-label !text-[8px]">{node.name} · {node.region} · Lv {node.level}</div>
        </div>
      </div>
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5"><AudioButton /><FullscreenButton /></div>

      <svg className="story-dialogue-tail" aria-hidden="true">
        <path ref={tailRef} fill={choir ? '#020617' : '#ffffff'} stroke={choir ? '#67e8f9' : '#0f172a'} strokeWidth="3" strokeLinejoin="round" style={{ opacity: 0 }} />
      </svg>

      <div className="story-dialogue-dock">
        <div ref={bubbleRef} role="region" aria-label="Story dialogue" aria-live="polite" aria-atomic="true"
          className={`story-dialogue-panel ${choir ? 'border-cyan-300 bg-slate-950' : 'border-slate-900 bg-white'}`}>
          <div className="mb-1 flex shrink-0 items-center gap-1.5">
            <GIcon name={meta.icon} size={13} style={{ color: choir ? meta.color : '#0f172a' }} />
            <span className="font-mono text-[10px] font-black tracking-[0.2em]" style={{ color: choir ? meta.color : '#0f172a' }}>{line.who}</span>
            <button
              onClick={(e) => { e.stopPropagation(); sound.speakDialogue(line.who, line.text); }}
              title="Replay Voice Line"
              className="ml-auto inline-flex items-center gap-1 rounded bg-black/10 px-1.5 py-0.5 font-mono text-[8px] font-bold text-slate-700 hover:bg-black/20"
            >
              <GIcon name="play" size={9} /> VOICE
            </button>
          </div>
          <p ref={textRef} tabIndex={0} className={`story-dialogue-copy ${choir ? 'font-mono text-cyan-200' : 'text-slate-900'}`}>{line.text}</p>
        </div>
        <div className="story-dialogue-controls">
          <button onClick={finishStory} className="btn !bg-slate-950/85">SKIP SCENE</button>
          <span className="font-mono text-[10px] text-white drop-shadow-md">{storyLines.length} line{storyLines.length === 1 ? '' : 's'} left</span>
          <button onClick={advanceStory} className="btn btn-primary !px-5 !text-[12px]">{storyLines.length > 1 ? 'NEXT' : 'TO BATTLE'}</button>
        </div>
      </div>
    </div>
  );
}

