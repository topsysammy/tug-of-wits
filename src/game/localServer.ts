/**
 * LocalMatchServer — the phase 1 stand-in for the Edge Function referee.
 *
 * It owns the secret answers, runs the shared referee, and plays side 1 as a simulated
 * opponent with randomised think times and network latency (so the grace window gets a real
 * workout). The UI only sees ServerEvents, exactly as it will over Supabase Realtime.
 */
import {
  COUNTDOWN_SECONDS,
  MAX_QUESTIONS,
  PRELOAD_AHEAD,
  RECONNECT_GRACE_SECONDS,
  REVEAL_MS,
  ROUND_MS,
} from '@shared/gameConfig.ts';
import type { ClientMessage, ServerEvent } from '@shared/protocol.ts';
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
} from '@shared/referee.ts';
import type { PlayerInfo, SecretQuestion, Side } from '@shared/types.ts';
import type { MatchTransport } from './transport.ts';

export type BotSkill = 'easy' | 'normal' | 'hard';

const SKILL: Record<BotSkill, { accuracy: number; minMs: number; maxMs: number }> = {
  easy: { accuracy: 0.55, minMs: 3500, maxMs: 10500 },
  normal: { accuracy: 0.72, minMs: 2200, maxMs: 8000 },
  hard: { accuracy: 0.88, minMs: 1200, maxMs: 4800 },
};

export interface LocalMatchOptions {
  me: Omit<PlayerInfo, 'side'>;
  bot: Omit<PlayerInfo, 'side'>;
  skill: BotSkill;
  questions: SecretQuestion[];
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle the options too, so the right answer isn't always in the same tile. */
function withShuffledOptions(q: SecretQuestion): SecretQuestion {
  const order = shuffled(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  };
}

export class LocalMatchServer implements MatchTransport {
  readonly mySide: Side = 0;
  private readonly botSide: Side = 1;

  private listeners = new Set<(ev: ServerEvent) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private roundTimers = new Set<ReturnType<typeof setTimeout>>();
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private forfeitTimer: ReturnType<typeof setTimeout> | null = null;

  private deck: SecretQuestion[] = [];
  private secrets = new Map<number, SecretQuestion>();
  private match: MatchState = newMatch();
  private round: RoundState | null = null;
  private nextRoundId = 1;
  private startedAt = 0;
  private paused = false;
  private disposed = false;
  private skill: BotSkill;

  constructor(private opts: LocalMatchOptions) {
    this.skill = opts.skill;
  }

  // ── MatchTransport ──

  subscribe(listener: (ev: ServerEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    const players: [PlayerInfo, PlayerInfo] = [
      { ...this.opts.me, side: 0 },
      { ...this.opts.bot, side: 1 },
    ];
    this.emit({
      t: 'match_start',
      players,
      category: 'naija-trivia',
      difficulty: 'easy',
      countdownMs: COUNTDOWN_SECONDS * 1000,
    });
    this.preload(1, 1 + PRELOAD_AHEAD);
    this.later(() => this.startRound(), COUNTDOWN_SECONDS * 1000 + 150);
  }

  send(msg: ClientMessage) {
    if (msg.t !== 'answer') return;
    // Simulated uplink latency from my phone to the referee.
    this.later(() => this.receiveAnswer(this.mySide, msg.round, msg.choice, msg.reportedMs), rand(30, 90));
  }

  dispose() {
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    this.clearRoundTimers();
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.timers.clear();
    this.listeners.clear();
  }

  // ── Dev controls (phase 1 sim panel) ──

  setSkill(skill: BotSkill) {
    this.skill = skill;
  }

  /** Simulate the opponent's connection dropping. */
  dropOpponent() {
    if (this.paused || this.match.finish || !this.round) return;
    this.paused = true;
    // Void the round in progress: the connected player shouldn't get extra time on it.
    this.clearRoundTimers();
    this.round = { ...this.round, settled: true };
    const graceMs = RECONNECT_GRACE_SECONDS * 1000;
    this.emit({ t: 'presence', side: this.botSide, online: false, forfeitInMs: graceMs });
    this.forfeitTimer = setTimeout(() => {
      this.forfeitTimer = null;
      this.match = forfeitMatch(this.match, this.botSide);
      this.endMatch();
    }, graceMs);
  }

  reconnectOpponent() {
    if (!this.paused || this.match.finish) return;
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.forfeitTimer = null;
    this.paused = false;
    this.emit({ t: 'presence', side: this.botSide, online: true });
    this.later(() => this.startRound(), 1200);
  }

  /** Dev cheat: submit the right answer for me right now (tests the winning side of the rope). */
  winRoundForMe() {
    const r = this.round;
    if (!r || r.settled || this.paused) return;
    const saw = Math.round(this.now() - r.openedAt);
    this.receiveAnswer(this.mySide, r.round, r.question.correctIndex, Math.max(300, saw - 40));
  }

  /** Jump close to the safety cap to test cap / sudden death. */
  skipToCap(questionsLeft = 2) {
    const target = Math.max(0, MAX_QUESTIONS - questionsLeft);
    if (this.match.questionsPlayed < target) this.match = { ...this.match, questionsPlayed: target };
  }

  // ── Referee loop ──

  private now() {
    return performance.now();
  }

  private emit(ev: ServerEvent, latencyMs = rand(20, 70)) {
    // Simulated downlink latency to my phone.
    this.later(() => this.listeners.forEach((l) => l(ev)), latencyMs);
  }

  private later(fn: () => void, ms: number, bucket = this.timers) {
    if (this.disposed) return;
    const t = setTimeout(() => {
      bucket.delete(t);
      if (!this.disposed) fn();
    }, ms);
    bucket.add(t);
  }

  private clearRoundTimers() {
    for (const t of this.roundTimers) clearTimeout(t);
    this.roundTimers.clear();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private draw(): SecretQuestion {
    if (this.deck.length === 0) this.deck = shuffled(this.opts.questions);
    return withShuffledOptions(this.deck.pop()!);
  }

  private preload(from: number, to: number) {
    const items = [];
    for (let r = from; r <= to; r++) {
      if (this.secrets.has(r)) continue;
      const q = this.draw();
      this.secrets.set(r, q);
      const { correctIndex: _hidden, ...pub } = q;
      items.push({ round: r, question: pub });
    }
    if (items.length) this.emit({ t: 'preload', items });
  }

  private startRound() {
    if (this.paused || this.match.finish) return;
    const id = this.nextRoundId++;
    const q = this.secrets.get(id)!;
    if (!this.startedAt) this.startedAt = this.now();

    this.round = openRound(id, q, this.now());
    this.emit({
      t: 'round_start',
      round: id,
      questionNumber: this.match.questionsPlayed + 1,
      suddenDeath: this.match.suddenDeath,
    });
    this.preload(id + 1, id + PRELOAD_AHEAD);
    this.planBot(q);
    this.scheduleSettle();
  }

  private planBot(q: SecretQuestion) {
    const s = SKILL[this.skill];
    const thinkMs = rand(s.minMs, s.maxMs);
    if (thinkMs > ROUND_MS - 200) return; // ran out of time, no answer
    const correct = Math.random() < s.accuracy;
    const wrongChoices = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
    const choice = correct ? q.correctIndex : wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    // Bot's own network: downlink + uplink, sometimes laggy, to exercise the grace window.
    const netMs = rand(40, 160) + (Math.random() < 0.25 ? rand(150, 450) : 0);
    const round = this.round!.round;
    this.later(() => this.receiveAnswer(this.botSide, round, choice, Math.round(thinkMs)), thinkMs + netMs, this.roundTimers);
  }

  private receiveAnswer(side: Side, round: number, choice: number, reportedMs: number) {
    const r = this.round;
    if (!r || r.round !== round || this.paused) {
      this.emit({ t: 'answer_ack', round, side, accepted: false, correct: false, reason: 'closed' });
      return;
    }
    const res = submitAnswer(r, side, choice, reportedMs, this.now());
    this.round = res.state;
    this.emit(
      res.ok
        ? { t: 'answer_ack', round, side, accepted: true, correct: res.correct }
        : { t: 'answer_ack', round, side, accepted: false, correct: false, reason: res.reason },
    );
    if (res.ok) this.scheduleSettle();
  }

  private scheduleSettle() {
    if (!this.round) return;
    if (this.settleTimer) clearTimeout(this.settleTimer);
    const wait = Math.max(0, settleDueAt(this.round) - this.now());
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.trySettle();
    }, wait);
  }

  private trySettle() {
    const r = this.round;
    if (!r || this.paused || r.settled) return;
    if (!isSettleDue(r, this.now())) return this.scheduleSettle();

    this.clearRoundTimers();
    const { state, record } = settleRound(r);
    this.round = state;
    this.match = applyRound(this.match, record);
    this.emit({
      t: 'round_end',
      round: r.round,
      winner: record.winner,
      reason: record.reason,
      correctIndex: record.correctIndex,
      pos: this.match.pos,
      wins: this.match.wins,
    });

    if (this.match.finish) this.later(() => this.endMatch(), REVEAL_MS);
    else this.later(() => this.startRound(), REVEAL_MS);
  }

  private endMatch() {
    if (!this.match.finish) return;
    this.clearRoundTimers();
    this.emit({
      t: 'match_end',
      finish: this.match.finish,
      pos: this.match.pos,
      wins: this.match.wins,
      history: this.match.history,
      durationMs: this.startedAt ? Math.round(this.now() - this.startedAt) : 0,
    });
  }
}
