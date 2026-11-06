import { motion } from 'framer-motion';
import type { MatchEndReason, PlayerInfo, RoundRecord, Side } from '@shared/types.ts';
import { Button } from '../ui/Button.tsx';
import { fmtClock, fmtSeconds, playerStats } from '../../game/stats.ts';

interface MatchEndSheetProps {
  iWon: boolean;
  reason: MatchEndReason;
  opp: PlayerInfo;
  mySide: Side;
  wins: { me: number; opp: number };
  history: RoundRecord[];
  durationMs: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

function title(iWon: boolean, reason: MatchEndReason, opp: string) {
  if (reason === 'forfeit') return iWon ? `${opp} didn't come back. You win by forfeit.` : 'You left the match.';
  if (reason === 'cap') return iWon ? 'Closest to the line at the whistle. You win!' : `${opp} was closer at the whistle.`;
  return iWon ? `You pulled ${opp} across the line!` : `${opp} dragged you over. Rematch?`;
}

function Tile({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div
      className={[
        'flex flex-col items-center gap-1 rounded-[18px] border-2 px-1.5 py-3',
        gold
          ? 'border-yellow bg-[#FFF1C9] shadow-[0_4px_0_var(--color-yellow-deep)]'
          : 'border-card-edge bg-card shadow-[0_4px_0_var(--color-card-shadow)]',
      ].join(' ')}
    >
      <span className={`text-xs font-extrabold whitespace-nowrap ${gold ? 'text-[#8A5A00]' : 'text-muted'}`}>{label}</span>
      <span className="font-display text-[22px] font-bold">{value}</span>
    </div>
  );
}

/** Phase 1 end-of-match sheet. Phase 3 adds the full Results screen behind "See results". */
export function MatchEndSheet(p: MatchEndSheetProps) {
  const stats = playerStats(p.history, p.mySide);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex flex-col justify-end gap-3.5 bg-ink/45 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
    >
      <motion.div
        initial={{ y: 60, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="flex flex-col items-center gap-2 rounded-[28px] border-[3px] border-white bg-cream p-6 text-center shadow-[0_5px_0_var(--color-card-shadow)]"
      >
        <span
          className={`rounded-full px-3.5 py-1 text-sm font-extrabold ${p.iWon ? 'bg-me-tint text-me-ink' : 'bg-opp-tint text-opp-ink'}`}
        >
          {p.iWon ? 'You win!' : `${p.opp.nickname} wins`}
        </span>
        <h2 id="end-title" className="m-0 font-display text-[28px] leading-tight font-bold">
          {title(p.iWon, p.reason, p.opp.nickname)}
        </h2>
        <span className="text-[15px] font-bold text-muted">
          Rounds won {p.wins.me}–{p.wins.opp}
        </span>
        <div className="mt-2 grid w-full grid-cols-3 gap-2.5">
          <Tile label="Match time" value={fmtClock(p.durationMs)} />
          <Tile label="Avg answer" value={fmtSeconds(stats.avgMs)} />
          <Tile label="Fastest" value={fmtSeconds(stats.fastestMs)} gold />
        </div>
      </motion.div>
      <Button variant="yellow" onClick={p.onPlayAgain}>
        Play again
      </Button>
      <Button variant="white" onClick={p.onExit}>
        Back
      </Button>
    </motion.div>
  );
}
