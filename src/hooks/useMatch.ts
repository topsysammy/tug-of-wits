import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ServerEvent } from '@shared/protocol.ts';
import type {
  CategoryId,
  MatchEndReason,
  PlayerInfo,
  PublicQuestion,
  RoundEndReason,
  RoundRecord,
  Side,
} from '@shared/types.ts';
import type { MatchTransport } from '../game/transport.ts';

/**
 * Client-side view of a match. It only mirrors what the referee says: the phone measures how
 * long the player took and sends that, but never decides who pulled.
 */

export type Phase = 'waiting' | 'countdown' | 'question' | 'reveal' | 'paused' | 'ended';
export type Who = 'me' | 'opp';

export interface ClientMatchState {
  phase: Phase;
  mySide: Side;
  me: PlayerInfo | null;
  opp: PlayerInfo | null;
  category: CategoryId | null;
  countdownEndsAt: number | null;
  questions: Record<number, PublicQuestion>;
  round: number | null;
  questionNumber: number;
  suddenDeath: boolean;
  myChoice: number | null;
  myVerdict: 'pending' | 'correct' | 'wrong' | 'rejected' | null;
  oppAnswer: 'correct' | 'wrong' | null;
  reveal: { winner: Who | null; reason: RoundEndReason; correctIndex: number } | null;
  /** Rope position from my point of view: negative = toward my line (left). */
  pos: number;
  wins: { me: number; opp: number };
  /** Bumps on every pull so the arena can shake. */
  pullSeq: number;
  oppOnline: boolean;
  forfeitAt: number | null;
  end: { iWon: boolean; reason: MatchEndReason; history: RoundRecord[]; durationMs: number } | null;
}

type Action = { type: 'event'; ev: ServerEvent; at: number } | { type: 'picked'; choice: number };

const initial = (mySide: Side): ClientMatchState => ({
  phase: 'waiting',
  mySide,
  me: null,
  opp: null,
  category: null,
  countdownEndsAt: null,
  questions: {},
  round: null,
  questionNumber: 0,
  suddenDeath: false,
  myChoice: null,
  myVerdict: null,
  oppAnswer: null,
  reveal: null,
  pos: 0,
  wins: { me: 0, opp: 0 },
  pullSeq: 0,
  oppOnline: true,
  forfeitAt: null,
  end: null,
});

function reducer(s: ClientMatchState, a: Action): ClientMatchState {
  if (a.type === 'picked') {
    if (s.phase !== 'question' || s.myChoice !== null) return s;
    return { ...s, myChoice: a.choice, myVerdict: 'pending' };
  }

  const ev = a.ev;
  const mine = (side: Side): Who => (side === s.mySide ? 'me' : 'opp');
  const myPos = (pos: number) => (s.mySide === 0 ? pos : -pos);
  const myWins = (w: [number, number]) => ({ me: w[s.mySide], opp: w[s.mySide === 0 ? 1 : 0] });

  switch (ev.t) {
    case 'match_start':
      return {
        ...initial(s.mySide),
        phase: 'countdown',
        me: ev.players[s.mySide],
        opp: ev.players[s.mySide === 0 ? 1 : 0],
        category: ev.category,
        countdownEndsAt: a.at + ev.countdownMs,
      };

    case 'preload': {
      const questions = { ...s.questions };
      for (const it of ev.items) questions[it.round] = it.question;
      return { ...s, questions };
    }

    case 'round_start':
      return {
        ...s,
        phase: 'question',
        round: ev.round,
        questionNumber: ev.questionNumber,
        suddenDeath: ev.suddenDeath,
        myChoice: null,
        myVerdict: null,
        oppAnswer: null,
        reveal: null,
      };

    case 'answer_ack':
      if (ev.round !== s.round) return s;
      if (mine(ev.side) === 'me') {
        return { ...s, myVerdict: !ev.accepted ? 'rejected' : ev.correct ? 'correct' : 'wrong' };
      }
      return ev.accepted ? { ...s, oppAnswer: ev.correct ? 'correct' : 'wrong' } : s;

    case 'round_end': {
      if (ev.round !== s.round) return s;
      const winner = ev.winner === null ? null : mine(ev.winner);
      return {
        ...s,
        phase: 'reveal',
        reveal: { winner, reason: ev.reason, correctIndex: ev.correctIndex },
        pos: myPos(ev.pos),
        wins: myWins(ev.wins),
        pullSeq: winner ? s.pullSeq + 1 : s.pullSeq,
      };
    }

    case 'presence':
      if (mine(ev.side) === 'me') return s;
      return ev.online
        ? { ...s, oppOnline: true, forfeitAt: null }
        : { ...s, phase: 'paused', round: null, oppOnline: false, forfeitAt: a.at + (ev.forfeitInMs ?? 0) };

    case 'match_end':
      return {
        ...s,
        phase: 'ended',
        oppOnline: true,
        forfeitAt: null,
        pos: myPos(ev.pos),
        wins: myWins(ev.wins),
        end: {
          iWon: ev.finish.winner === s.mySide,
          reason: ev.finish.reason,
          history: ev.history,
          durationMs: ev.durationMs,
        },
      };
  }
}

/**
 * `createTransport` must be stable (memoise it per match). The transport is created inside the
 * effect so React StrictMode's mount → unmount → mount gets a fresh one each time.
 */
export function useMatch<T extends MatchTransport>(createTransport: () => T, mySide: Side = 0) {
  const [state, dispatch] = useReducer(reducer, mySide, initial);
  const transportRef = useRef<T | null>(null);
  /** performance.now() when the question for `round` was actually painted. */
  const [shown, setShown] = useState<{ round: number; at: number } | null>(null);
  const shownRef = useRef<{ round: number; at: number } | null>(null);

  useEffect(() => {
    const transport = createTransport();
    transportRef.current = transport;
    const off = transport.subscribe((ev) => dispatch({ type: 'event', ev, at: performance.now() }));
    transport.start();
    return () => {
      off();
      transport.dispose();
      transportRef.current = null;
    };
  }, [createTransport]);

  const question = state.round !== null ? state.questions[state.round] ?? null : null;
  const questionVisible = state.phase === 'question' && question !== null;

  // Start the player's clock on the frame the question is painted, not when the event arrived.
  useEffect(() => {
    if (!questionVisible || state.round === null) return;
    const round = state.round;
    const raf = requestAnimationFrame(() => {
      const v = { round, at: performance.now() };
      shownRef.current = v;
      setShown(v);
    });
    return () => cancelAnimationFrame(raf);
  }, [questionVisible, state.round]);

  const shownAt = questionVisible && shown?.round === state.round ? shown.at : null;

  const answer = useCallback(
    (choice: number) => {
      const transport = transportRef.current;
      if (!transport || state.phase !== 'question' || state.myChoice !== null || state.round === null) return;
      const started = shownRef.current;
      if (!started || started.round !== state.round) return;
      const reportedMs = Math.round(performance.now() - started.at);
      dispatch({ type: 'picked', choice });
      transport.send({ t: 'answer', round: state.round, choice, reportedMs });
    },
    [state.phase, state.myChoice, state.round],
  );

  return { state, question, shownAt, answer, transportRef };
}
