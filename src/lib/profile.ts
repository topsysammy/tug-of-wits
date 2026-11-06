import type { CharacterId } from '@shared/types.ts';
import { CHARACTERS } from '../game/characters.ts';

/** Nickname + character, saved on the device. No accounts. */
export interface Profile {
  nickname: string;
  character: CharacterId;
}

const KEY = 'tow.profile.v1';
const DEFAULT: Profile = { nickname: 'Topsy', character: 'topsy' };

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      nickname: typeof p.nickname === 'string' && p.nickname.trim() ? p.nickname.slice(0, 14) : DEFAULT.nickname,
      character: p.character && p.character in CHARACTERS ? p.character : DEFAULT.character,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode / storage blocked: the game still works, it just won't remember.
  }
}
