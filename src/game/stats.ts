import type { RoundRecord, Side } from '@shared/types.ts';

export interface PlayerStats {
  roundsWon: number;
  /** Mean of this player's valid answer times, ms. */
  avgMs: number | null;
  /** Fastest correct answer, ms. */
  fastestMs: number | null;
}

export function playerStats(history: RoundRecord[], side: Side): PlayerStats {
  const times = history.map((r) => r.times[side]).filter((t): t is number => t !== null);
  const correctTimes = history
    .filter((r) => r.correct[side] === true)
    .map((r) => r.times[side])
    .filter((t): t is number => t !== null);
  return {
    roundsWon: history.filter((r) => r.winner === side).length,
    avgMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    fastestMs: correctTimes.length ? Math.min(...correctTimes) : null,
  };
}

export const fmtSeconds = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)}s`);

export function fmtClock(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
