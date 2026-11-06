/**
 * The referee: pure, clock-injected functions that decide every round and every match.
 *
 * Phase 1 runs this in the browser (LocalMatchServer) against a simulated opponent.
 * Phase 2 runs the very same file inside the Supabase Edge Function. Nothing here touches
 * timers, networks or randomness — callers pass `now` in, which keeps it testable.
 */
import {
  CLOSE_SLACK_MS,
  GRACE_MS,
  MAX_LATENCY_CREDIT_MS,
  MAX_QUESTIONS,
  MIN_ANSWER_MS,
  ROUND_MS,
  STEPS_TO_WIN,
} from './gameConfig.ts';
import type { MatchFinish, RoundEndReason, RoundRecord, SecretQuestion, Side } from './types.ts';

// ───────────────────────────── Rounds ─────────────────────────────

export interface Submission {
  side: Side;
  choice: number;
  /** Time the phone measured from the question appearing to the tap. */
  reportedMs: number;
  /** Server clock when the answer arrived. */
  receivedAt: number;
  correct: boolean;
}

export interface RoundState {
  round: number;
  question: SecretQuestion;
  /** Server clock when round_start was sent. */
  openedAt: number;
  submissions: Submission[];
  firstCorrectAt: number | null;
  settled: boolean;
}

export type RejectReason =
  | 'closed'
  | 'duplicate'
  | 'bad_choice'
  | 'too_fast'
  | 'too_slow'
  | 'implausible';

export type SubmitResult =
  | { ok: true; state: RoundState; correct: boolean }
  | { ok: false; state: RoundState; reason: RejectReason };

export function openRound(round: number, question: SecretQuestion, now: number): RoundState {
  return { round, question, openedAt: now, submissions: [], firstCorrectAt: null, settled: false };
}

export function roundClosesAt(r: RoundState): number {
  return r.openedAt + ROUND_MS + CLOSE_SLACK_MS;
}

export function submitAnswer(
  r: RoundState,
  side: Side,
  choice: number,
  reportedMs: number,
  now: number,
): SubmitResult {
  const reject = (reason: RejectReason): SubmitResult => ({ ok: false, state: r, reason });

  if (r.settled || now > roundClosesAt(r)) return reject('closed');
  if (r.submissions.some((s) => s.side === side)) return reject('duplicate');
  if (!Number.isInteger(choice) || choice < 0 || choice >= r.question.options.length) {
    return reject('bad_choice');
  }
  if (!Number.isFinite(reportedMs) || reportedMs < MIN_ANSWER_MS) return reject('too_fast');
  if (reportedMs > ROUND_MS) return reject('too_slow');

  // The phone can't have taken *longer* than the server saw (small clock jitter allowed),
  // and it can't claim much less than the server saw beyond believable network latency.
  const serverSaw = now - r.openedAt;
  if (reportedMs > serverSaw + 50 || reportedMs < serverSaw - MAX_LATENCY_CREDIT_MS) {
    return reject('implausible');
  }

  const correct = choice === r.question.correctIndex;
  const sub: Submission = { side, choice, reportedMs, receivedAt: now, correct };
  const state: RoundState = {
    ...r,
    submissions: [...r.submissions, sub],
    firstCorrectAt: correct && r.firstCorrectAt === null ? now : r.firstCorrectAt,
  };
  return { ok: true, state, correct };
}

/** Server clock time at which this round should be settled. */
export function settleDueAt(r: RoundState): number {
  if (r.submissions.length >= 2) {
    return Math.max(...r.submissions.map((s) => s.receivedAt));
  }
  if (r.firstCorrectAt !== null) return Math.min(r.firstCorrectAt + GRACE_MS, roundClosesAt(r));
  return roundClosesAt(r);
}

export function isSettleDue(r: RoundState, now: number): boolean {
  return !r.settled && now >= settleDueAt(r);
}

export interface RoundOutcome {
  record: RoundRecord;
  state: RoundState;
}

/** Award the round to the shortest valid reported time among correct answers. */
export function settleRound(r: RoundState): RoundOutcome {
  const correct = r.submissions
    .filter((s) => s.correct)
    .sort((a, b) => a.reportedMs - b.reportedMs || a.receivedAt - b.receivedAt);

  const winner = correct.length ? correct[0].side : null;
  let reason: RoundEndReason = 'pull';
  if (winner === null) reason = r.submissions.length >= 2 ? 'both_wrong' : 'time_up';

  const bySide = (side: Side) => r.submissions.find((s) => s.side === side);
  const a = bySide(0);
  const b = bySide(1);

  return {
    state: { ...r, settled: true },
    record: {
      round: r.round,
      winner,
      reason,
      correctIndex: r.question.correctIndex,
      times: [a?.reportedMs ?? null, b?.reportedMs ?? null],
      correct: [a ? a.correct : null, b ? b.correct : null],
    },
  };
}

// ───────────────────────────── Match ─────────────────────────────

export interface MatchState {
  /** Negative = toward side 0's line, positive = toward side 1's line. */
  pos: number;
  /** Questions settled so far (voided rounds don't count). */
  questionsPlayed: number;
  wins: [number, number];
  suddenDeath: boolean;
  history: RoundRecord[];
  finish: MatchFinish | null;
}

export function newMatch(): MatchState {
  return { pos: 0, questionsPlayed: 0, wins: [0, 0], suddenDeath: false, history: [], finish: null };
}

export function applyRound(m: MatchState, record: RoundRecord): MatchState {
  if (m.finish) return m;
  const next: MatchState = {
    ...m,
    questionsPlayed: m.questionsPlayed + 1,
    history: [...m.history, record],
    wins: [...m.wins] as [number, number],
  };

  if (record.winner !== null) {
    next.pos += record.winner === 0 ? -1 : 1;
    next.wins[record.winner] += 1;
  }

  if (Math.abs(next.pos) >= STEPS_TO_WIN) {
    next.finish = { winner: next.pos < 0 ? 0 : 1, reason: 'line' };
  } else if (next.questionsPlayed >= MAX_QUESTIONS) {
    // Safety cap: nearer to their line wins; level → sudden death (next pull wins).
    if (next.pos !== 0) next.finish = { winner: next.pos < 0 ? 0 : 1, reason: 'cap' };
    else next.suddenDeath = true;
  }
  return next;
}

export function forfeitMatch(m: MatchState, absent: Side): MatchState {
  if (m.finish) return m;
  return { ...m, finish: { winner: absent === 0 ? 1 : 0, reason: 'forfeit' } };
}
