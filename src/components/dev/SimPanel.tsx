import { useState } from 'react';
import type { BotSkill, LocalMatchServer } from '../../game/localServer.ts';
import { Icon } from '../ui/Icon.tsx';

/** Phase 1 test controls for the simulated opponent. Dev builds or ?sim only. */
export function SimPanel({ getServer, initialSkill }: { getServer: () => LocalMatchServer | null; initialSkill: BotSkill }) {
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState<BotSkill>(initialSkill);

  const act = (fn: (s: LocalMatchServer) => void) => () => {
    const s = getServer();
    if (s) fn(s);
  };

  return (
    <div className="fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex w-56 flex-col gap-2 rounded-2xl border-2 border-card-edge bg-card p-3 text-sm shadow-[0_4px_0_var(--color-card-shadow)]">
          <span className="font-display text-base font-semibold">Simulator</span>
          <span className="text-xs text-muted">Opponent skill</span>
          <div className="grid grid-cols-3 gap-1">
            {(['easy', 'normal', 'hard'] as BotSkill[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSkill(k);
                  getServer()?.setSkill(k);
                }}
                className={`h-11 rounded-xl capitalize ${skill === k ? 'bg-blue text-white' : 'bg-muted-tile text-ink'}`}
              >
                {k}
              </button>
            ))}
          </div>
          <button type="button" className="h-11 rounded-xl bg-wrong text-wrong-ink" onClick={act((s) => s.dropOpponent())}>
            Drop opponent
          </button>
          <button type="button" className="h-11 rounded-xl bg-correct text-correct-ink" onClick={act((s) => s.reconnectOpponent())}>
            Reconnect opponent
          </button>
          <button type="button" className="h-11 rounded-xl bg-me-tint text-me-ink" onClick={act((s) => s.winRoundForMe())}>
            Win this round for me
          </button>
          <button type="button" className="h-11 rounded-xl bg-yellow text-yellow-ink" onClick={act((s) => s.skipToCap(2))}>
            Skip to question 39
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Simulator controls"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-[0_3px_0_rgba(0,0,0,0.25)]"
      >
        <Icon name={open ? 'x' : 'sliders'} size={20} />
      </button>
    </div>
  );
}
