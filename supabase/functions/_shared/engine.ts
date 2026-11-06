/**
 * The match engine: the whole server-side game loop as pure functions over a JSON-safe
 * `ServerMatch`. Each call takes the clock (`now`) and returns the new state, the events to
 * broadcast, and when the engine next needs a `tick`.
 *
 * - The Edge Function stores `ServerMatch` in Postgres (row-locked per room), broadcasts the
 *   events over Realtime, and schedules the wake-up.
 * - Practice mode (LocalMatchServer) runs the exact same functions in the browser.
 */
import {
  COUNTDOWN_SECONDS,
  PRELOAD_AHEAD,
  RECONNECT_GRACE_SECONDS,
  REVEAL_MS,
} from './gameConfig.ts';
import type { ServerEvent, SyncEvent } from './protocol.ts';
import {
  applyRound,
  forfeitMatch,
  isSettleDue,
  newMatch,
  openRound,
  settleDueAt,
  settleRound,
  submitAnswer,
  type MatchState,
  type RoundState,
} from './referee.ts';
import { generateMathQuestion } from './mathGen.ts';
import type {
  CategoryId,
  Difficulty,
  PlayerInfo,
  PublicQuestion,
  SecretQuestion,
  Side,
} from './types.ts';

/** Pause between a dropped player coming back and the next question. */
export const RESUME_DELAY_MS = 1500;
/** Extra beat after the countdown so "1" is visible before the question lands. */
const COUNTDOWN_TAIL_MS = 150;

export type ServerPhase = 'waiting' | 'question' | 'paused' | 'ended';

export interface ServerMatch {
  v: 1;
  players: [PlayerInfo, PlayerInfo];
  category: CategoryId;
  difficulty: Difficulty;
  match: MatchState;
  /** Current round, or the last one (settled) while waiting. */
  round: RoundState | null;
  phase: ServerPhase;
  /** While waiting: when the next round opens (after countdown, reveal or resume). */
  nextAt: number | null;
  nextRoundId: number;
  /** Questions already handed out, keyed by round id. */
  secrets: Record<string, SecretQuestion>;
  /** Questions not yet handed out. Refilled from `pool` (reshuffled) when empty. */
  deck: SecretQuestion[];
  pool: SecretQuestion[];
  paused: { absentSide: Side; forfeitAt: number } | null;
  startedAt: number | null;
  endedAt: number | null;
}

export interface Step {
  state: ServerMatch;
  events: ServerEvent[];
  /** Server clock time of the next required tick, or null if nothing is pending. */
  wakeAt: number | null;
}

type Rng = () => number;

const other = (side: Side): Side => (side === 0 ? 1 : 0);

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle a question's options so the right answer moves around. */
function shuffleOptions(q: SecretQuestion, rng: Rng): SecretQuestion {
  const order = shuffle(q.options.map((_, i) => i), rng);
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

export function toPublic(q: SecretQuestion): PublicQuestion {
  const { correctIndex: _hidden, ...pub } = q;
  return pub;
}

function draw(s: ServerMatch, roundId: number, rng: Rng): SecretQuestion {
  if (s.category === 'quick-maths') {
    return generateMathQuestion(s.difficulty, rng, `math-${roundId}-${Math.floor(rng() * 1e6)}`);
  }
  if (s.deck.length === 0) s.deck = shuffle(s.pool, rng);
  const q = s.deck.pop();
  if (!q) throw new Error('No questions available for this category');
  return shuffleOptions(q, rng);
}

/** Make sure rounds [from, to] have questions; returns the ones newly handed out. */
function preload(s: ServerMatch, from: number, to: number, rng: Rng): ServerEvent[] {
  const items: { round: number; question: PublicQuestion }[] = [];
  for (let r = from; r <= to; r++) {
    if (s.secrets[r]) continue;
    s.secrets[r] = draw(s, r, rng);
    items.push({ round: r, question: toPublic(s.secrets[r]) });
  }
  return items.length ? [{ t: 'preload', items }] : [];
}

function clone(s: ServerMatch): ServerMatch {
  return structuredClone(s);
}

function wakeFor(s: ServerMatch): number | null {
  switch (s.phase) {
    case 'waiting':
      return s.nextAt;
    case 'question':
      return s.round && !s.round.settled ? settleDueAt(s.round) : null;
    case 'paused':
      return s.paused?.forfeitAt ?? null;
    default:
      return null;
  }
}

function step(state: ServerMatch, events: ServerEvent[]): Step {
  return { state, events, wakeAt: wakeFor(state) };
}

function endEvent(s: ServerMatch): ServerEvent {
  return {
    t: 'match_end',
    finish: s.match.finish!,
    pos: s.match.pos,
    wins: s.match.wins,
    history: s.match.history,
    durationMs: s.startedAt && s.endedAt ? Math.round(s.endedAt - s.startedAt) : 0,
  };
}

// ───────────────────────────── API ─────────────────────────────

export interface CreateMatchInput {
  players: [PlayerInfo, PlayerInfo];
  category: CategoryId;
  difficulty: Difficulty;
  /** Questions to draw from (ignored for Quick Maths, which is generated). */
  pool: SecretQuestion[];
  now: number;
  rng?: Rng;
}

export function createServerMatch({ players, category, difficulty, pool, now, rng = Math.random }: CreateMatchInput): Step {
  const s: ServerMatch = {
    v: 1,
    players,
    category,
    difficulty,
    match: newMatch(),
    round: null,
    phase: 'waiting',
    nextAt: now + COUNTDOWN_SECONDS * 1000 + COUNTDOWN_TAIL_MS,
    nextRoundId: 1,
    secrets: {},
    deck: shuffle(pool, rng),
    pool,
    paused: null,
    startedAt: null,
    endedAt: null,
  };
  const events: ServerEvent[] = [
    { t: 'match_start', players, category, difficulty, countdownMs: COUNTDOWN_SECONDS * 1000 },
    ...preload(s, 1, 1 + PRELOAD_AHEAD, rng),
  ];
  return step(s, events);
}

/** Advance anything that's due: open the next round, settle a round, finish, or forfeit. */
export function tick(input: ServerMatch, now: number, rng: Rng = Math.random): Step {
  const s = clone(input);
  const events: ServerEvent[] = [];

  // Loop in case several transitions are due at once (e.g. a very late tick).
  for (let guard = 0; guard < 4; guard++) {
    if (s.phase === 'ended') break;

    if (s.phase === 'paused') {
      if (s.paused && now >= s.paused.forfeitAt) {
        s.match = forfeitMatch(s.match, s.paused.absentSide);
        s.paused = null;
        s.phase = 'ended';
        s.endedAt = now;
        events.push(endEvent(s));
      }
      break;
    }

    if (s.phase === 'waiting') {
      if (s.nextAt === null || now < s.nextAt) break;
      if (s.match.finish) {
        s.phase = 'ended';
        s.endedAt = now;
        s.nextAt = null;
        events.push(endEvent(s));
        break;
      }
      const id = s.nextRoundId++;
      events.push(...preload(s, id, id + PRELOAD_AHEAD, rng));
      s.round = openRound(id, s.secrets[id], now);
      s.phase = 'question';
      s.nextAt = null;
      if (s.startedAt === null) s.startedAt = now;
      events.push({
        t: 'round_start',
        round: id,
        questionNumber: s.match.questionsPlayed + 1,
        suddenDeath: s.match.suddenDeath,
      });
      continue;
    }

    // question
    const r = s.round;
    if (!r || r.settled || !isSettleDue(r, now)) break;
    const { state, record } = settleRound(r);
    s.round = state;
    s.match = applyRound(s.match, record);
    events.push({
      t: 'round_end',
      round: r.round,
      winner: record.winner,
      reason: record.reason,
      correctIndex: record.correctIndex,
      pos: s.match.pos,
      wins: s.match.wins,
    });
    s.phase = 'waiting';
    s.nextAt = now + REVEAL_MS;
  }

  return step(s, events);
}

/** A phone's answer arrives at the referee. */
export function answer(
  input: ServerMatch,
  side: Side,
  round: number,
  choice: number,
  reportedMs: number,
  now: number,
): Step {
  // Settle anything already due first, so a late answer can't sneak in.
  const pre = tick(input, now);
  const s = pre.state;
  const events = [...pre.events];

  if (s.phase !== 'question' || !s.round || s.round.round !== round) {
    events.push({ t: 'answer_ack', round, side, accepted: false, correct: false, reason: 'closed' });
    return step(s, events);
  }
  const res = submitAnswer(s.round, side, choice, reportedMs, now);
  s.round = res.state;
  events.push(
    res.ok
      ? { t: 'answer_ack', round, side, accepted: true, correct: res.correct }
      : { t: 'answer_ack', round, side, accepted: false, correct: false, reason: res.reason },
  );
  // Both answered → settles immediately; otherwise the grace window / timer applies.
  const post = tick(s, now);
  return step(post.state, [...events, ...post.events]);
}

/** `reporter` says the other player has gone. Pause, void the open round, start the forfeit clock. */
export function reportAbsent(input: ServerMatch, reporter: Side, now: number): Step {
  const s = clone(input);
  if (s.phase === 'ended' || s.phase === 'paused' || s.match.finish) return step(s, []);
  const absentSide = other(reporter);
  if (s.round && !s.round.settled) s.round = { ...s.round, settled: true }; // voided: not applied
  s.phase = 'paused';
  s.nextAt = null;
  const forfeitInMs = RECONNECT_GRACE_SECONDS * 1000;
  s.paused = { absentSide, forfeitAt: now + forfeitInMs };
  return step(s, [{ t: 'presence', side: absentSide, online: false, forfeitInMs }]);
}

/** `side` is here (came back, or was wrongly reported absent). */
export function resume(input: ServerMatch, side: Side, now: number): Step {
  const s = clone(input);
  if (s.phase !== 'paused' || !s.paused || s.paused.absentSide !== side) return step(s, []);
  s.paused = null;
  s.phase = 'waiting';
  s.nextAt = now + RESUME_DELAY_MS;
  return step(s, [{ t: 'presence', side, online: true }]);
}

/** Everything one side needs to render the match right now. */
export function syncFor(s: ServerMatch, side: Side, now: number): SyncEvent {
  const r = s.round;
  const last = s.match.history[s.match.history.length - 1];
  const roundWasPlayed = !!r && !!last && last.round === r.round;

  let phase: SyncEvent['phase'];
  if (s.phase === 'ended') phase = 'ended';
  else if (s.phase === 'paused') phase = 'paused';
  else if (s.phase === 'question') phase = 'question';
  else if (!r) phase = 'countdown';
  else phase = roundWasPlayed ? 'reveal' : 'resuming';

  const questions: SyncEvent['questions'] = [];
  for (const [key, q] of Object.entries(s.secrets)) {
    const id = Number(key);
    if (id >= (r?.round ?? 1)) questions.push({ round: id, question: toPublic(q) });
  }

  const mineSub = r?.submissions.find((x) => x.side === side);
  const oppSub = r?.submissions.find((x) => x.side !== side);
  const showRound = phase === 'question' || phase === 'reveal';

  return {
    t: 'sync',
    players: s.players,
    category: s.category,
    difficulty: s.difficulty,
    phase,
    countdownMs: phase === 'countdown' && s.nextAt !== null ? Math.max(0, s.nextAt - now) : null,
    round: showRound ? r!.round : null,
    questionNumber: s.match.questionsPlayed + (phase === 'question' ? 1 : 0),
    suddenDeath: s.match.suddenDeath,
    questions,
    roundElapsedMs: phase === 'question' ? Math.max(0, now - r!.openedAt) : null,
    mine: showRound && mineSub ? { choice: mineSub.choice, correct: mineSub.correct } : null,
    oppAnswer: showRound && oppSub ? (oppSub.correct ? 'correct' : 'wrong') : null,
    reveal:
      phase === 'reveal' && last
        ? { winner: last.winner, reason: last.reason, correctIndex: last.correctIndex }
        : null,
    pos: s.match.pos,
    wins: s.match.wins,
    paused: s.paused ? { absentSide: s.paused.absentSide, forfeitInMs: Math.max(0, s.paused.forfeitAt - now) } : null,
    end:
      phase === 'ended' && s.match.finish
        ? (({ t: _t, ...rest }) => rest)(endEvent(s) as Extract<ServerEvent, { t: 'match_end' }>)
        : null,
  };
}

/** Question ids handed out in this match (so a rematch can avoid repeats). */
export function usedQuestionIds(s: ServerMatch): string[] {
  return Object.values(s.secrets).map((q) => q.id);
}
