import { useState, type ReactNode } from 'react';
import { useGame } from '../game/store';
import GIcon from './GameIcon';
import FullscreenButton from './Fullscreen';
import AudioButton from './AudioButton';

/** Shared HUD primitives: header bar (with audio mute and fullscreen button) and a pager so menus never scroll. */

export function HudBar({ title, sub, icon = 'mountain', back = false, right }: { title: string; sub?: string; icon?: string; back?: boolean; right?: ReactNode }) {
  const setScreen = useGame(s => s.setScreen);
  return (
    <header className="hud-bar">
      {back && <button className="btn" onClick={() => setScreen('map')}><GIcon name="map" size={13} />MAP</button>}
      <GIcon name={icon} size={18} className="text-teal-300" />
      <div className="leading-none"><div className="hud-title">{title}</div>{sub && <div className="hud-label mt-1">{sub}</div>}</div>
      <div className="ml-auto flex items-center gap-1.5">{right}<AudioButton /><FullscreenButton /></div>
    </header>
  );
}

export function usePager<T>(items: T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages - 1);
  return { items: items.slice(p * size, p * size + size), page: p, pages, setPage };
}

export function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>PREV</button>
      <span className="hud-label">{page + 1} / {pages}</span>
      <button className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>NEXT</button>
    </div>
  );
}
