import type { ClientMatchState } from '../hooks/useMatch.ts';
import type { TileLook } from '../components/match/AnswerGrid.tsx';
import type { StatusTone } from '../components/match/StatusLine.tsx';
import type { IconName } from '../components/ui/Icon.tsx';

/** Pure mapping from match state → what the tiles and status line show. */

export function tileLooks(s: ClientMatchState, optionCount: number): TileLook[] {
  return Array.from({ length: optionCount }, (_, i): TileLook => {
    if (s.reveal) {
      if (i === s.reveal.correctIndex) return 'correct';
      if (i === s.myChoice) return 'wrong';
      return 'muted';
    }
    if (s.myChoice === null) return 'idle';
    if (i !== s.myChoice) return 'muted';
    if (s.myVerdict === 'wrong') return 'wrong';
    if (s.myVerdict === 'rejected') return 'muted';
    return 'picked';
  });
}

export interface Status {
  text: string;
  tone: StatusTone;
  icon?: IconName;
}

export function statusFor(s: ClientMatchState, timeUp: boolean): Status {
  const opp = s.opp?.nickname ?? 'Opponent';

  if (s.phase === 'paused') {
    return s.oppOnline
      ? { text: `${opp} is back. Next question…`, tone: 'good' }
      : { text: 'Match paused', tone: 'muted', icon: 'wifiOff' };
  }
  if (s.phase === 'ended') return { text: 'Match over', tone: 'muted' };

  if (s.reveal) {
    switch (s.reveal.reason) {
      case 'pull':
        return s.reveal.winner === 'me'
          ? { text: 'You pulled first!', tone: 'me', icon: 'bolt' }
          : { text: `${opp} pulled first`, tone: 'opp' };
      case 'both_wrong':
        return { text: 'Both wrong, no pull', tone: 'muted' };
      default:
        return { text: 'Time up, no pull', tone: 'muted', icon: 'clock' };
    }
  }

  if (s.phase !== 'question') return { text: 'Get ready…', tone: 'muted' };

  switch (s.myVerdict) {
    case 'wrong':
      return { text: 'Wrong! You’re locked out this round', tone: 'danger', icon: 'lock' };
    case 'correct':
      return { text: 'Correct! Checking who was faster…', tone: 'good', icon: 'check' };
    case 'pending':
      return { text: 'Locked in…', tone: 'muted' };
    case 'rejected':
      return { text: 'Too late for that one', tone: 'muted', icon: 'clock' };
  }

  if (timeUp) return { text: 'Time’s up', tone: 'muted', icon: 'clock' };
  if (s.oppAnswer === 'wrong') return { text: `${opp} answered wrong. Take your time`, tone: 'good', icon: 'x' };
  if (s.oppAnswer === 'correct') return { text: `${opp} answered…`, tone: 'opp' };
  return { text: `${opp} is thinking…`, tone: 'muted' };
}
