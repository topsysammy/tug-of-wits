import { describe, expect, it } from 'vitest';
import {
  applyRound,
  forfeitMatch,
  isSettleDue,
  newMatch,
  openRound,
  settleDueAt,
  settleRound,
  submitAnswer,
  type RoundState,
} from '@shared/referee.ts';
import { GRACE_MS, MAX_QUESTIONS, ROUND_MS, CLOSE_SLACK_MS, STEPS_TO_WIN } from '@shared/gameConfig.ts';
import type { RoundRecord, SecretQuestion } from '@shared/types.ts';

const Q: SecretQuestion = {
  id: 'q1',
  text: '7 × 8?',
  options: ['54', '56', '58', '64'],
  correctIndex: 1,
  category: 'quick-maths',
  difficulty: 'easy',
};

const T0 = 10_000;
const open = () => openRound(1, Q, T0);
function submit(r: RoundState, side: 0 | 1, choice: number, reportedMs: number, at: number) {
  const res = submitAnswer(r, side, choice, reportedMs, at);
  return res;
}

describe('submitAnswer', () => {
  it('rejects impossible times under 250 ms', () => {
    const res = submit(open(), 0, 1, 200, T0 + 300);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('too_fast');
  });

  it('rejects answers after the round closes', () => {
    const res = submit(open(), 0, 1, 9_000, T0 + ROUND_MS + CLOSE_SLACK_MS + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('closed');
  });

  it('rejects a second answer from the same player (lockout)', () => {
    const r = submit(open(), 0, 0, 2_000, T0 + 2_100).state;
    const res = submit(r, 0, 1, 3_000, T0 + 3_100);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('duplicate');
  });

  it('rejects claimed times far below what the server observed', () => {
    const res = submit(open(), 0, 1, 500, T0 + 6_000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('implausible');
  });
});

describe('settling a round', () => {
  it('waits the grace window after the first correct answer', () => {
    const r = submit(open(), 0, 1, 3_000, T0 + 3_400).state;
    expect(settleDueAt(r)).toBe(T0 + 3_400 + GRACE_MS);
    expect(isSettleDue(r, T0 + 3_500)).toBe(false);
    expect(isSettleDue(r, T0 + 3_400 + GRACE_MS)).toBe(true);
  });

  it('awards the faster reported time even if it arrived later (slow network)', () => {
    let r = submit(open(), 1, 1, 3_000, T0 + 3_100).state; // fast network, 3.0 s
    r = submit(r, 0, 1, 2_800, T0 + 3_300).state; // slow network, 2.8 s, arrives in grace
    const { record } = settleRound(r);
    expect(record.winner).toBe(0);
    expect(record.reason).toBe('pull');
  });

  it('a wrong answer never wins, even if fastest', () => {
    let r = submit(open(), 0, 0, 1_000, T0 + 1_100).state;
    r = submit(r, 1, 1, 4_000, T0 + 4_100).state;
    expect(settleRound(r).record.winner).toBe(1);
  });

  it('both wrong → no pull, settled immediately', () => {
    let r = submit(open(), 0, 0, 1_000, T0 + 1_100).state;
    r = submit(r, 1, 2, 2_000, T0 + 2_100).state;
    expect(settleDueAt(r)).toBe(T0 + 2_100);
    expect(settleRound(r).record).toMatchObject({ winner: null, reason: 'both_wrong' });
  });

  it('time up → no pull', () => {
    const r = open();
    expect(settleDueAt(r)).toBe(T0 + ROUND_MS + CLOSE_SLACK_MS);
    expect(settleRound(r).record).toMatchObject({ winner: null, reason: 'time_up' });
  });
});

const rec = (winner: 0 | 1 | null): RoundRecord => ({
  round: 0,
  winner,
  reason: winner === null ? 'time_up' : 'pull',
  correctIndex: 0,
  times: [null, null],
  correct: [null, null],
});

describe('match', () => {
  it(`first to ${STEPS_TO_WIN} wins at the line`, () => {
    let m = newMatch();
    for (let i = 0; i < STEPS_TO_WIN; i++) m = applyRound(m, rec(1));
    expect(m.finish).toEqual({ winner: 1, reason: 'line' });
    expect(m.pos).toBe(STEPS_TO_WIN);
  });

  it('safety cap: nearer to their line wins', () => {
    let m = { ...newMatch(), questionsPlayed: MAX_QUESTIONS - 1 };
    m = applyRound(m, rec(0));
    expect(m.finish).toEqual({ winner: 0, reason: 'cap' });
  });

  it('safety cap: level → sudden death, then next pull wins', () => {
    let m = { ...newMatch(), questionsPlayed: MAX_QUESTIONS - 1 };
    m = applyRound(m, rec(null));
    expect(m.finish).toBeNull();
    expect(m.suddenDeath).toBe(true);
    m = applyRound(m, rec(null));
    expect(m.finish).toBeNull();
    m = applyRound(m, rec(1));
    expect(m.finish).toEqual({ winner: 1, reason: 'cap' });
  });

  it('forfeit gives the win to the connected player', () => {
    expect(forfeitMatch(newMatch(), 1).finish).toEqual({ winner: 0, reason: 'forfeit' });
  });
});
