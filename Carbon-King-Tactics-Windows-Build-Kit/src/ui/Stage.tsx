import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGame, type Screen } from '../game/store';

/**
 * 16:9 landscape letterbox. Screen changes play a wipe: cover -> swap content -> reveal.
 * `render` receives the screen currently on display (which lags the store by the cover duration).
 */
export default function Stage({ render }: { render: (s: Screen) => ReactNode }) {
  const target = useGame(s => s.screen);
  const [shown, setShown] = useState<Screen>(target);
  const [wipe, setWipe] = useState<'idle' | 'cover' | 'reveal'>('idle');
  const shownRef = useRef(shown);

  useEffect(() => {
    if (target === shownRef.current) { setWipe('idle'); return; }
    setWipe('cover');
    const t1 = window.setTimeout(() => { shownRef.current = target; setShown(target); setWipe('reveal'); }, 270);
    const t2 = window.setTimeout(() => setWipe('idle'), 270 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [target]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 50% 30%, #0e2138 0%, #05070c 70%)' }} />
      <div className="stage-shell relative overflow-hidden">
        {render(shown)}
        {wipe !== 'idle' && <div className={`wipe ${wipe === 'cover' ? 'wipe-cover' : 'wipe-reveal'}`}><div className="wipe-mark">CARBON KING</div></div>}
        <Toast />
        <div className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-cyan-400/20" />
      </div>
    </div>
  );
}

function Toast() {
  const toast = useGame(s => s.toast);
  const toastId = useGame(s => s.toastId);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, [toast, toastId]);
  if (!toast || !show) return null;
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-[300] -translate-x-1/2 animate-[toastup_.25s_ease-out]">
      <div className="glass whitespace-nowrap px-4 py-2 font-mono text-xs font-bold text-cyan-200">{toast}</div>
    </div>
  );
}
