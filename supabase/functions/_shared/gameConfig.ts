/**
 * Tug of Wits — game rules.
 *
 * The single source of truth for match tuning. It lives under supabase/functions/_shared
 * so the browser (via the `@shared` alias) and the Edge Function referee (Deno) read the
 * exact same numbers. Tune these after playtests (PRD → "Starting values").
 */

/** Steps from centre to a win line. Rope position runs -STEPS_TO_WIN … +STEPS_TO_WIN. */
export const STEPS_TO_WIN = 5;

/** Options per multiple-choice question. */
export const ANSWER_OPTIONS = 4;

/** Seconds a player has to answer once the question shows on their screen. */
export const ROUND_SECONDS = 10;
export const ROUND_MS = ROUND_SECONDS * 1000;

/** Reveal of the correct answer + pull animation before the next question. */
export const REVEAL_MS = 1500;

/** Safety cap. After this many questions the player nearer their line wins (sudden death if level). */
export const MAX_QUESTIONS = 40;

/** After the first correct answer arrives, wait this long for a faster-but-laggier one. */
export const GRACE_MS = 300;

/** Reported answer times below this are treated as impossible and rejected. */
export const MIN_ANSWER_MS = 250;

/**
 * Extra time the server keeps a round open past ROUND_MS, so an answer tapped at 9.9 s on a
 * slow network still arrives before the round closes.
 */
export const CLOSE_SLACK_MS = 700;

/**
 * The most a reported time may undercut what the server itself observed (question sent →
 * answer received). Covers real network latency while stopping "I answered in 0.3 s" claims
 * on an answer that took the server 8 s to receive.
 */
export const MAX_LATENCY_CREDIT_MS = 2000;

/** Questions sent ahead of time so a weak connection doesn't delay their display. */
export const PRELOAD_AHEAD = 2;

/** 3-2-1 countdown before the first question. */
export const COUNTDOWN_SECONDS = 3;

/** How long a dropped player has to come back before the other wins by forfeit. */
export const RECONNECT_GRACE_SECONDS = 20;

/** Rooms with no activity for this long are expired. */
export const ROOM_IDLE_MINUTES = 30;

/** Room codes: 5 chars, no ambiguous 0/O/1/I. */
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
