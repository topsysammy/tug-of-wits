/** Room shapes and validation shared by the lobby UI and the Edge Function. */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './gameConfig.ts';
import type { CategoryId, CharacterId, Difficulty, Side } from './types.ts';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayer {
  side: Side;
  nickname: string;
  character: CharacterId;
  ready: boolean;
}

export interface RoomSnapshot {
  code: string;
  category: CategoryId;
  difficulty: Difficulty;
  status: RoomStatus;
  /** [host, guest]; guest is null until someone joins. */
  players: [RoomPlayer, RoomPlayer | null];
}

/** Lobby updates broadcast on the room channel (event name `lobby`). */
export type LobbyEvent = { t: 'room'; room: RoomSnapshot } | { t: 'closed' };

/** Categories that currently have questions. Others show as "coming soon". */
export const PLAYABLE_CATEGORIES: CategoryId[] = ['naija-trivia', 'quick-maths'];

export const CATEGORY_IDS: CategoryId[] = [
  'quick-maths',
  'general-knowledge',
  'naija-trivia',
  'science',
  'football',
  'bible-quran',
];
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
export const CHARACTER_IDS: CharacterId[] = ['topsy', 'tolu', 'ada', 'emeka'];
export const NICKNAME_MAX = 14;

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercase and strip anything that isn't a letter or digit (spaces, dashes from pasting). */
export function normaliseRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch));
}

export function cleanNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
  return name.length ? name : null;
}
