/** Shared types for the browser and the Edge Function referee. Keep this file dependency-free. */

/** 0 = host, 1 = guest. Rope position is negative toward side 0 and positive toward side 1. */
export type Side = 0 | 1;

export type Difficulty = 'easy' | 'medium' | 'hard';

export type CategoryId =
  | 'quick-maths'
  | 'general-knowledge'
  | 'naija-trivia'
  | 'science'
  | 'football'
  | 'bible-quran';

export type CharacterId = 'topsy' | 'tolu' | 'ada' | 'emeka';

export interface PlayerInfo {
  side: Side;
  nickname: string;
  character: CharacterId;
}

/** What phones get to see. Never contains the answer. */
export interface PublicQuestion {
  id: string;
  text: string;
  options: string[];
  category: CategoryId;
  difficulty: Difficulty;
  image?: string;
}

/** What only the referee holds until the reveal. */
export interface SecretQuestion extends PublicQuestion {
  correctIndex: number;
}

export type RoundEndReason = 'pull' | 'both_wrong' | 'time_up' | 'void';

export interface RoundRecord {
  round: number;
  winner: Side | null;
  reason: RoundEndReason;
  correctIndex: number;
  /** Reported answer time per side, null if that side didn't (validly) answer. */
  times: [number | null, number | null];
  /** Whether each side's answer was correct, null if no answer. */
  correct: [boolean | null, boolean | null];
}

export type MatchEndReason = 'line' | 'cap' | 'forfeit';

export interface MatchFinish {
  winner: Side;
  reason: MatchEndReason;
}
