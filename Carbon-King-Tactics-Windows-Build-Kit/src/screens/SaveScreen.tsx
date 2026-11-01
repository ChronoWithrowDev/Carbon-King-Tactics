import { useMemo, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { nodeById } from '../game/world';
import { jobById } from '../game/jobs';
import {
  SAVE_SLOTS, listSaves, exportSaveJson, formatPlayTime, formatSavedAt,
  type SaveSlotId,
} from '../game/saves';
import GIcon from '../ui/GameIcon';
import FullscreenButton from '../ui/Fullscreen';
import AudioButton from '../ui/AudioButton';

/** Dedicated 16:9 Save / Load Archive screen. Fits a 2x2 grid with zero scrolling. */
export default function SaveScreen() {
  const g = useGame();
  const [confirmDel, setConfirmDel] = useState<SaveSlotId | null>(null);
  const [importTarget, setImportTarget] = useState<SaveSlotId>('slot1');
  const fileRef = useRef<HTMLInputElement>(null);

  const saves = useMemo(() => listSaves(), [g.saveRev]);
  const canSave = g.party.length > 0 && g.savesReturnTo !== 'title';
  const backLabel = g.savesReturnTo === 'title' ? 'TITLE' : g.savesReturnTo === 'ending' ? 'ENDING' : 'MAP';
  const backIcon = g.savesReturnTo === 'title' ? 'crown' : 'map';

  const handleExport = (slot: SaveSlotId) => {
    const json = exportSaveJson(slot);
    if (!json) { g.notify('Nothing in that slot to export.'); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbon-king-${slot}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    g.notify(`Exported ${slot.toUpperCase()} backup file.`);
  };

  const triggerImport = (slot: SaveSlotId) => {
    setImportTarget(slot);
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') g.importToSlot(reader.result, importTarget);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full flex-col bg-[#060b16] text-slate-100">
      <header className="hud-bar">
        <button className="btn" onClick={() => g.setScreen(g.savesReturnTo)}>
          <GIcon name={backIcon} size={13} />{backLabel}
        </button>
        <GIcon name="save" size={18} className="text-teal-300" />
        <div className="leading-none">
          <div className="hud-title">Lattice Archive</div>
          <div className="hud-label mt-1">autosave · 3 manual slots · json backup</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {canSave && (
            <>
              <span className="chip bg-cyan-400/15 text-cyan-200">
                <GIcon name="map" size={11} />{nodeById(g.currentNode).name}
              </span>
              <span className="chip bg-amber-400/15 text-amber-300">
                <GIcon name="clock" size={11} />{formatPlayTime(g.playTimeSec)}
              </span>
              <button className="btn" onClick={() => g.setScreen('title')}>
                <GIcon name="crown" size={12} />TITLE SCREEN
              </button>
            </>
          )}
          <AudioButton />
          <FullscreenButton />
        </div>
      </header>

      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFilePicked} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="hud-body !text-[11px] text-slate-400">
            {canSave
              ? 'Progress autosaves after every battle, journey, and camp upgrade. Use manual slots for branching checkpoints or export a .json backup.'
              : 'Select a recorded campaign to resume your march across Colorado, or import a .json archive file into any slot.'}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2.5">
          {SAVE_SLOTS.map(slotMeta => {
            const rec = saves[slotMeta.id];
            const isAuto = !!slotMeta.auto;
            const confirming = confirmDel === slotMeta.id;
            return (
              <div
                key={slotMeta.id}
                className="glass flex min-h-0 flex-col justify-between p-3"
                style={{ borderColor: isAuto ? 'rgba(45,226,208,0.42)' : rec ? 'rgba(227,185,74,0.38)' : 'rgba(148,163,184,0.18)' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`chip ${isAuto ? 'bg-teal-400/20 text-teal-200' : 'bg-amber-400/20 text-amber-200'}`}>
                      <GIcon name={isAuto ? 'orbit' : 'save'} size={11} />{slotMeta.label}
                    </span>
                    {rec ? (
                      <span className="hud-label ml-auto !tracking-[0.14em] !text-slate-400">
                        saved {formatSavedAt(rec.savedAt)}
                      </span>
                    ) : (
                      <span className="hud-label ml-auto !text-slate-600">EMPTY</span>
                    )}
                  </div>

                  {rec ? (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <div className="truncate text-[16px] font-black text-white">{rec.summary.locationName}</div>
                        <div className="hud-label shrink-0 !tracking-[0.14em]">{rec.summary.region}</div>
                      </div>
                      <div className="hud-objective mt-0.5 truncate text-[11.5px]">{rec.summary.questLabel}</div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="chip bg-white/5 text-cyan-200">{rec.summary.visitedCount}/{rec.summary.totalNodes} nodes</span>
                        <span className="chip bg-white/5 text-violet-200"><GIcon name="swords" size={10} />{rec.summary.battlesWon} wins</span>
                        <span className="chip bg-white/5 text-amber-300"><GIcon name="coins" size={10} />{rec.summary.gold}G</span>
                        <span className="chip bg-white/5 text-slate-300"><GIcon name="clock" size={10} />{formatPlayTime(rec.summary.playTimeSec)}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {rec.summary.partyPreview.map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                            <GIcon name={p.icon} size={12} style={{ color: p.color }} />
                            <b className="max-w-[78px] truncate">{p.name.split(' ')[0]}</b>
                            <span className="font-mono text-[9px] text-slate-400">Lv{p.level} {jobById(p.jobId)?.name.split(' ')[0] ?? ''}</span>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 flex flex-col items-center justify-center py-3 text-center">
                      <GIcon name="folder" size={24} className="text-slate-600" />
                      <div className="hud-body mt-1 !text-[11px] text-slate-500">
                        {isAuto ? 'Autosave activates automatically once a campaign begins.' : 'Empty manual archive slot.'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2">
                  {!isAuto && canSave && (
                    <button
                      onClick={() => { setConfirmDel(null); g.saveToSlot(slotMeta.id); }}
                      className="btn btn-gold !min-h-[32px] flex-1"
                    >
                      <GIcon name="save" size={13} />{rec ? 'OVERWRITE' : 'SAVE HERE'}
                    </button>
                  )}
                  {isAuto && (
                    <span className="hud-label mr-auto !text-[8px] !tracking-[0.18em] text-teal-300/80">
                      AUTO CHECKPOINT
                    </span>
                  )}

                  <button
                    disabled={!rec}
                    onClick={() => { setConfirmDel(null); g.loadFromSlot(slotMeta.id); }}
                    className="btn btn-primary !min-h-[32px] flex-1"
                  >
                    <GIcon name="play" size={13} />LOAD
                  </button>

                  <button
                    disabled={!rec}
                    onClick={() => handleExport(slotMeta.id)}
                    title="Export save as .json file"
                    className="btn !min-h-[32px] !px-2.5"
                  >
                    <GIcon name="download" size={13} />
                  </button>

                  {!isAuto && (
                    <button
                      onClick={() => triggerImport(slotMeta.id)}
                      title="Import .json save file into this slot"
                      className="btn !min-h-[32px] !px-2.5"
                    >
                      <GIcon name="upload" size={13} />
                    </button>
                  )}

                  {rec && (
                    <button
                      onClick={() => {
                        if (confirming) {
                          g.removeSaveSlot(slotMeta.id);
                          setConfirmDel(null);
                        } else {
                          setConfirmDel(slotMeta.id);
                        }
                      }}
                      title={confirming ? 'Click again to permanently delete' : 'Delete slot'}
                      className={`btn !min-h-[32px] !px-2.5 ${confirming ? 'btn-danger' : ''}`}
                    >
                      <GIcon name="trash" size={13} />{confirming && 'CONFIRM?'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
