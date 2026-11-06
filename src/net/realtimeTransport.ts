/**
 * RealtimeTransport — the online MatchTransport.
 *
 * Events come from the referee over the room channel; answers and housekeeping go to the
 * Edge Function. It also:
 *  - asks for a full `sync` on start and after any reconnect (so a reload rejoins mid-match),
 *  - tells the referee when the opponent's presence has been gone for a few seconds,
 *  - answers "you're missing" with a resume when this phone is actually here,
 *  - sends a watchdog `tick` if an expected event is overdue (the server's own timer is the
 *    primary clock; this is the backup).
 */
import { CLOSE_SLACK_MS, GRACE_MS, REVEAL_MS, ROUND_MS } from '@shared/gameConfig.ts';
import { RESUME_DELAY_MS } from '@shared/engine.ts';
import type { ClientMessage, ServerEvent, SyncEvent } from '@shared/protocol.ts';
import type { Side } from '@shared/types.ts';
import type { MatchTransport } from '../game/transport.ts';
import { api } from './api.ts';
import type { RoomChannel } from './roomChannel.ts';

/** Opponent must be gone this long before we report them (rides out a quick blip/reload). */
const ABSENCE_DEBOUNCE_MS = 4000;
/** If we've never seen the opponent, wait longer before reporting. */
const FIRST_SEEN_GRACE_MS = 9000;
const WATCHDOG_SLACK_MS = 900;
const WATCHDOG_RETRY_MS = 2500;
const WATCHDOG_MAX_RETRIES = 6;

export class RealtimeTransport implements MatchTransport {
  readonly mySide: Side;
  private listeners = new Set<(ev: ServerEvent) => void>();
  private offs: (() => void)[] = [];
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private absenceTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private live = false;
  private paused = false;
  private disposed = false;
  private startedAt = 0;

  constructor(private room: RoomChannel) {
    this.mySide = room.side;
  }

  subscribe(listener: (ev: ServerEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    this.startedAt = Date.now();
    this.offs.push(
      this.room.onServer((ev) => this.handle(ev)),
      this.room.onPresence(() => this.checkAbsence()),
      this.room.onStatus((online, reconnected) => {
        this.emit({ t: 'link', online });
        if (online && reconnected) void this.resync();
      }),
    );
    void this.room.connect().then(() => this.resync());
  }

  send(msg: ClientMessage) {
    if (msg.t !== 'answer') return;
    api.answer(this.room.code, msg.round, msg.choice, msg.reportedMs).catch(() => {
      // One retry on a network blip; the referee rejects it if the round has closed.
      setTimeout(() => void api.answer(this.room.code, msg.round, msg.choice, msg.reportedMs).catch(() => {}), 400);
    });
  }

  dispose() {
    this.disposed = true;
    this.offs.forEach((off) => off());
    this.offs = [];
    this.clearWatchdog();
    if (this.absenceTimer) clearTimeout(this.absenceTimer);
    this.listeners.clear();
  }

  // ── internals ──

  private emit(ev: ServerEvent) {
    if (!this.disposed) this.listeners.forEach((l) => l(ev));
  }

  private async resync() {
    try {
      const { sync } = await api.resume(this.room.code);
      if (sync) this.handle(sync);
    } catch {
      this.arm(WATCHDOG_RETRY_MS, () => this.resync());
    }
  }

  private handle(ev: ServerEvent) {
    if (this.disposed) return;
    switch (ev.t) {
      case 'match_start':
        this.live = true;
        this.paused = false;
        this.armTick(ev.countdownMs);
        break;
      case 'round_start':
        this.paused = false;
        this.armTick(ROUND_MS + CLOSE_SLACK_MS);
        break;
      case 'answer_ack':
        if (ev.accepted && ev.correct) this.armTick(GRACE_MS);
        break;
      case 'round_end':
        this.armTick(REVEAL_MS);
        break;
      case 'presence':
        if (ev.side === this.mySide) {
          // The referee thinks we're gone, but we're right here.
          if (!ev.online) void this.resync();
          return;
        }
        this.paused = !ev.online;
        this.armTick(ev.online ? RESUME_DELAY_MS : ev.forfeitInMs ?? 0);
        break;
      case 'match_end':
        this.live = false;
        this.clearWatchdog();
        break;
      case 'sync':
        this.onSync(ev);
        break;
    }
    this.emit(ev);
    this.checkAbsence();
  }

  private onSync(ev: SyncEvent) {
    this.live = ev.phase !== 'ended';
    this.paused = ev.phase === 'paused' && ev.paused?.absentSide !== this.mySide;
    if (ev.phase === 'countdown') this.armTick(ev.countdownMs ?? 0);
    else if (ev.phase === 'question') this.armTick(ROUND_MS + CLOSE_SLACK_MS - (ev.roundElapsedMs ?? 0));
    else if (ev.phase === 'reveal') this.armTick(REVEAL_MS);
    else if (ev.phase === 'resuming') this.armTick(RESUME_DELAY_MS);
    else if (ev.phase === 'paused' && ev.paused) this.armTick(ev.paused.forfeitInMs);
    else this.clearWatchdog();
  }

  /** Expect the referee to move on within `ms`; nudge it with a tick if it doesn't. */
  private armTick(ms: number) {
    this.retries = 0;
    this.arm(Math.max(0, ms) + WATCHDOG_SLACK_MS, () => this.nudge());
  }

  private nudge() {
    if (!this.live || this.disposed) return;
    void api.tick(this.room.code).catch(() => {});
    if (++this.retries <= WATCHDOG_MAX_RETRIES) this.arm(WATCHDOG_RETRY_MS, () => this.nudge());
  }

  private arm(ms: number, fn: () => void) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      fn();
    }, ms);
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private checkAbsence() {
    const shouldWatch = this.live && !this.paused && this.room.online && !this.room.oppPresent;
    if (!shouldWatch) {
      if (this.absenceTimer) clearTimeout(this.absenceTimer);
      this.absenceTimer = null;
      return;
    }
    if (this.absenceTimer) return;
    const sinceStart = Date.now() - this.startedAt;
    const wait = Math.max(ABSENCE_DEBOUNCE_MS, FIRST_SEEN_GRACE_MS - sinceStart);
    this.absenceTimer = setTimeout(() => {
      this.absenceTimer = null;
      if (this.live && !this.paused && this.room.online && !this.room.oppPresent) {
        void api.reportAbsent(this.room.code).catch(() => {});
      }
    }, wait);
  }
}
