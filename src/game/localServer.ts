/**
 * LocalMatchServer — practice mode.
 *
 * Runs the same match engine as the Edge Function, in the browser, with a simulated friend on
 * side 1 (randomised think times and network lag, so the grace window gets a real workout).
 * The UI only sees ServerEvents, exactly as it does online.
 */
import { MAX_QUESTIONS, ROUND_MS } from '@shared/gameConfig.ts';
import type { ClientMessage, ServerEvent } from '@shared/protocol.ts';
import { answer, createServerMatch, reportAbsent, resume, syncFor, tick, type ServerMatch, type Step } from '@shared/engine.ts';
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

export class LocalMatchServer implements MatchTransport {
  readonly mySide: Side = 0;
  private readonly botSide: Side = 1;

  private listeners = new Set<(ev: ServerEvent) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private state: ServerMatch | null = null;
  private disposed = false;
  private lastDeliverAt = 0;
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
    this.apply(
      createServerMatch({
        players: [
          { ...this.opts.me, side: 0 },
          { ...this.opts.bot, side: 1 },
        ],
        category: 'naija-trivia',
        difficulty: 'easy',
        pool: this.opts.questions,
        now: this.now(),
      }),
    );
  }

  send(msg: ClientMessage) {
    if (msg.t !== 'answer') return;
    // Simulated uplink latency from my phone to the referee.
    this.later(() => this.receive(this.mySide, msg.round, msg.choice, msg.reportedMs), rand(30, 90));
  }

  dispose() {
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.timers.clear();
    this.listeners.clear();
  }

  // ── Dev controls (simulator panel) ──

  setSkill(skill: BotSkill) {
    this.skill = skill;
  }

  dropOpponent() {
    if (this.state) this.apply(reportAbsent(this.state, this.mySide, this.now()));
  }

  reconnectOpponent() {
    if (this.state) this.apply(resume(this.state, this.botSide, this.now()));
  }

  /** Dev cheat: submit the right answer for me right now. */
  winRoundForMe() {
    const r = this.state?.round;
    if (!r || r.settled || this.state?.phase !== 'question') return;
    const saw = Math.round(this.now() - r.openedAt);
    this.receive(this.mySide, r.round, r.question.correctIndex, Math.max(300, saw - 40));
  }

  /** Jump close to the safety cap to test cap / sudden death. */
  skipToCap(questionsLeft = 2) {
    if (!this.state) return;
    const target = Math.max(0, MAX_QUESTIONS - questionsLeft);
    if (this.state.match.questionsPlayed < target) {
      this.state = { ...this.state, match: { ...this.state.match, questionsPlayed: target } };
    }
  }

  /** What a phone rejoining now would be sent (exposed for tests/devtools). */
  sync(side: Side = 0) {
    return this.state ? syncFor(this.state, side, this.now()) : null;
  }

  // ── Loop ──

  private now() {
    return performance.now();
  }

  private later(fn: () => void, ms: number) {
    if (this.disposed) return;
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(t);
  }

  private receive(side: Side, round: number, choice: number, reportedMs: number) {
    if (this.state) this.apply(answer(this.state, side, round, choice, reportedMs, this.now()));
  }

  private apply(step: Step) {
    if (this.disposed) return;
    this.state = step.state;
    for (const ev of step.events) {
      if (ev.t === 'round_start') this.planBot(ev.round);
      if (ev.t === 'round_end' || ev.t === 'match_end' || (ev.t === 'presence' && !ev.online)) this.cancelBot();
    }
    // Simulated downlink latency to my phone, never reordering batches.
    const batch = step.events;
    if (batch.length) {
      const at = Math.max(this.lastDeliverAt, this.now() + rand(20, 70));
      this.lastDeliverAt = at;
      this.later(() => batch.forEach((ev) => this.listeners.forEach((l) => l(ev))), at - this.now());
    }

    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (step.wakeAt !== null) {
      this.wakeTimer = setTimeout(() => {
        this.wakeTimer = null;
        if (this.state && !this.disposed) this.apply(tick(this.state, this.now()));
      }, Math.max(0, step.wakeAt - this.now()));
    }
  }

  private cancelBot() {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }

  private planBot(round: number) {
    this.cancelBot();
    const q = this.state?.secrets[round];
    if (!q) return;
    const s = SKILL[this.skill];
    const thinkMs = rand(s.minMs, s.maxMs);
    if (thinkMs > ROUND_MS - 200) return; // ran out of time, no answer
    const correct = Math.random() < s.accuracy;
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
    const choice = correct ? q.correctIndex : wrong[Math.floor(Math.random() * wrong.length)];
    // Bot's own network: downlink + uplink, sometimes laggy.
    const netMs = rand(40, 160) + (Math.random() < 0.25 ? rand(150, 450) : 0);
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.receive(this.botSide, round, choice, Math.round(thinkMs));
    }, thinkMs + netMs);
  }
}
