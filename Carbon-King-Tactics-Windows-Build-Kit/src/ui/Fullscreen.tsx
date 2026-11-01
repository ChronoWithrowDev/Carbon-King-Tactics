import { useCallback, useEffect, useState } from 'react';
import { useGame } from '../game/store';
import GIcon from './GameIcon';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** Fullscreen API with webkit fallback. Fails gracefully (toast) when the embedding page blocks it. */
function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync); };
  }, []);
  const toggle = useCallback(async () => {
    try {
      const d = document as FsDoc, el = document.documentElement as FsEl;
      if (on) await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      else await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    } catch {
      useGame.getState().notify('Fullscreen is blocked here — open the game in its own tab, or press F11.');
    }
  }, [on]);
  return { on, toggle };
}

export default function FullscreenButton({ label = false, className = '' }: { label?: boolean; className?: string }) {
  const { on, toggle } = useFullscreen();
  return (
    <button onClick={toggle} title={on ? 'Exit fullscreen' : 'Fullscreen'} aria-label={on ? 'Exit fullscreen' : 'Enter fullscreen'} className={`btn ${className}`}>
      <GIcon name={on ? 'minimize' : 'maximize'} size={14} />{label && (on ? 'EXIT FULLSCREEN' : 'FULLSCREEN')}
    </button>
  );
}
