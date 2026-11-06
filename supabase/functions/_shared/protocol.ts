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
  | {
      t: 'match_end';
      finish: MatchFinish;
      pos: number;
      wins: [number, number];
      history: RoundRecord[];
      durationMs: number;
    };

export type ClientMessage = { t: 'answer'; round: number; choice: number; reportedMs: number };
