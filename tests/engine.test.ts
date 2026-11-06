import { describe, expect, it } from 'vitest';
import { answer, createServerMatch, reportAbsent, resume, syncFor, tick, type Step } from '@shared/engine.ts';
import { COUNTDOWN_SECONDS, GRACE_MS, RECONNECT_GRACE_SECONDS, REVEAL_MS, ROUND_MS, CLOSE_SLACK_MS, STEPS_TO_WIN } from '@shared/gameConfig.ts';
import { generateMathQuestion } from '@shared/mathGen.ts';
import type { PlayerInfo, SecretQuestion } from '@shared/types.ts';

const players: [PlayerInfo, PlayerInfo] = [
  { side: 0, nickname: 'Topsy', character: 'topsy' },
  { side: 1, nickname: 'Tolu', character: 'tolu' },
];
const pool: SecretQuestion[] = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`, text: `Q${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: i % 4, category: 'naija-trivia', difficulty: 'easy',
}));

function start(now = 0): Step {
  return createServerMatch({ players, category: 'naija-trivia', difficulty: 'easy', pool, now });
}
/** Run ticks until the first question is open. */
function toQuestion(st: Step): Step {
  return tick(st.state, st.wakeAt!);
}

describe('engine', () => {
  it('starts with a countdown and preloads questions without answers', () => {
    const st = start();
    expect(st.events[0].t).toBe('match_start');
    const pre = st.events.find((e) => e.t === 'preload');
    expect(pre && pre.t === 'preload' && pre.items.length).toBe(3);
    expect(JSON.stringify(st.events)).not.toContain('correctIndex');
    expect(st.wakeAt).toBeGreaterThanOrEqual(COUNTDOWN_SECONDS * 1000);
  });

  it('runs a round: correct answer, grace window, pull, reveal, next round', () => {
    let st = toQuestion(start());
    const t0 = st.state.round!.openedAt;
    const q = st.state.round!.question;
    expect(st.events.some((e) => e.t === 'round_start')).toBe(true);

    st = answer(st.state, 1, 1, q.correctIndex, 2_000, t0 + 2_100);
    expect(st.wakeAt).toBe(t0 + 2_100 + GRACE_MS);
    st = tick(st.state, st.wakeAt!);
    const end = st.events.find((e) => e.t === 'round_end');
    expect(end).toMatchObject({ winner: 1, pos: 1 });
    expect(st.wakeAt).toBe(t0 + 2_100 + GRACE_MS + REVEAL_MS);

    st = tick(st.state, st.wakeAt!);
    expect(st.events.find((e) => e.t === 'round_start')).toMatchObject({ round: 2, questionNumber: 2 });
  });

  it('settles at time up when nobody answers', () => {
    let st = toQuestion(start());
    const t0 = st.state.round!.openedAt;
    expect(st.wakeAt).toBe(t0 + ROUND_MS + CLOSE_SLACK_MS);
    st = tick(st.state, st.wakeAt!);
    expect(st.events.find((e) => e.t === 'round_end')).toMatchObject({ winner: null, reason: 'time_up' });
  });

  it('rejects an answer for a round that is not open', () => {
    const st = answer(start().state, 0, 1, 0, 1_000, 500);
    expect(st.events).toContainEqual(expect.objectContaining({ t: 'answer_ack', accepted: false, reason: 'closed' }));
  });

  it('plays to the line and ends after the reveal', () => {
    let st = toQuestion(start());
    for (let i = 0; i < STEPS_TO_WIN; i++) {
      const r = st.state.round!;
      st = answer(st.state, 0, r.round, r.question.correctIndex, 1_000, r.openedAt + 1_100);
      st = tick(st.state, st.wakeAt!); // settle after grace
      st = tick(st.state, st.wakeAt!); // reveal over → next round or end
    }
    const fin = st.events.find((e) => e.t === 'match_end');
    expect(fin).toMatchObject({ finish: { winner: 0, reason: 'line' } });
    expect(st.state.phase).toBe('ended');
  });

  it('pauses on a reported drop, voids the round, and forfeits after the grace', () => {
    let st = toQuestion(start());
    const now = st.state.round!.openedAt + 3_000;
    st = reportAbsent(st.state, 0, now);
    expect(st.events).toEqual([{ t: 'presence', side: 1, online: false, forfeitInMs: RECONNECT_GRACE_SECONDS * 1000 }]);
    expect(st.state.match.questionsPlayed).toBe(0);
    st = tick(st.state, now + RECONNECT_GRACE_SECONDS * 1000);
    expect(st.events.find((e) => e.t === 'match_end')).toMatchObject({ finish: { winner: 0, reason: 'forfeit' } });
  });

  it('resumes with a fresh question when the dropped player comes back', () => {
    let st = toQuestion(start());
    const now = st.state.round!.openedAt + 3_000;
    st = reportAbsent(st.state, 0, now);
    expect(resume(st.state, 0, now + 10).events).toEqual([]); // only the absent side can resume
    st = resume(st.state, 1, now + 5_000);
    expect(st.events).toEqual([{ t: 'presence', side: 1, online: true }]);
    st = tick(st.state, st.wakeAt!);
    expect(st.events.find((e) => e.t === 'round_start')).toMatchObject({ round: 2, questionNumber: 1 });
  });

  it('sync gives a rejoining phone the current question and elapsed time', () => {
    const st = toQuestion(start());
    const t0 = st.state.round!.openedAt;
    const sync = syncFor(st.state, 1, t0 + 4_000);
    expect(sync).toMatchObject({ phase: 'question', round: 1, questionNumber: 1, roundElapsedMs: 4_000 });
    expect(sync.questions.map((q) => q.round)).toEqual([1, 2, 3]);
    expect(JSON.stringify(sync)).not.toContain('correctIndex');
  });
});

describe('quick maths generator', () => {
  it('always has 4 distinct options including the right answer', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 300; i++) {
        const q = generateMathQuestion(d);
        expect(new Set(q.options).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        // eslint-disable-next-line no-new-func
        const expr = q.text.replace(' = ?', '').replace('×', '*').replace('÷', '/').replace('−', '-').replace(/(\d+)²/, '$1**2');
        expect(String(Function(`return ${expr}`)())).toBe(q.options[q.correctIndex]);
      }
    }
  });
});
