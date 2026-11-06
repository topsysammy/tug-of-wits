/**
 * Messages between phones and the referee. Phase 1 passes them in memory; phase 2 sends the
 * same shapes over a Supabase Realtime channel (one per room).
 */
import type {
  CategoryId,
  Difficulty,
  MatchFinish,
  PlayerInfo,
  PublicQuestion,
  RoundEndReason,
  RoundRecord,
  Side,
} from './types.ts';
import type { RejectReason } from './referee.ts';

export type ServerEvent =
  | {
      t: 'match_start';
      players: [PlayerInfo, PlayerInfo];
      category: CategoryId;
      difficulty: Difficulty;
      countdownMs: number;
    }
  /** Questions sent ahead of their round. A later preload for the same round replaces it. */
  | { t: 'preload'; items: { round: number; question: PublicQuestion }[] }
  | { t: 'round_start'; round: number; questionNumber: number; suddenDeath: boolean }
  /** Sent after each answer. `correct` is only meaningful when accepted. */
  | {
      t: 'answer_ack';
      round: number;
      side: Side;
      accepted: boolean;
      correct: boolean;
      reason?: RejectReason;
    }
  | {
      t: 'round_end';
      round: number;
      winner: Side | null;
      reason: RoundEndReason;
      correctIndex: number;
      pos: number;
      wins: [number, number];
    }
  /** A player dropped (online=false) or came back (online=true). */
  | { t: 'presence'; side: Side; online: boolean; forfeitInMs?: number }
  | MatchEndEvent
  | SyncEvent
  /** Client-local: this phone's own connection to the room dropped or came back. Never sent by the server. */
  | { t: 'link'; online: boolean };

export interface MatchEndEvent {
  t: 'match_end';
  finish: MatchFinish;
  pos: number;
  wins: [number, number];
  history: RoundRecord[];
  durationMs: number;
}

/**
 * Full picture of the match for one side — sent when a phone opens the match screen or
 * comes back after a drop, so it can render without having seen earlier events.
 */
export interface SyncEvent {
  t: 'sync';
  players: [PlayerInfo, PlayerInfo];
  category: CategoryId;
  difficulty: Difficulty;
  phase: 'countdown' | 'question' | 'reveal' | 'paused' | 'resuming' | 'ended';
  /** Countdown: ms until the first question. */
  countdownMs: number | null;
  round: number | null;
  questionNumber: number;
  suddenDeath: boolean;
  /** The current round's question (if any) plus the preloaded ones. */
  questions: { round: number; question: PublicQuestion }[];
  /** How long the current question has been open, so a rejoining phone's clock lines up. */
  roundElapsedMs: number | null;
  /** This side's answer in the current round, if any. */
  mine: { choice: number; correct: boolean } | null;
  oppAnswer: 'correct' | 'wrong' | null;
  reveal: { winner: Side | null; reason: RoundEndReason; correctIndex: number } | null;
  pos: number;
  wins: [number, number];
  paused: { absentSide: Side; forfeitInMs: number } | null;
  end: Omit<MatchEndEvent, 't'> | null;
}

export type ClientMessage = { t: 'answer'; round: number; choice: number; reportedMs: number };
