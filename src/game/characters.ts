import type { CharacterId } from '@shared/types.ts';

export interface CharacterLook {
  id: CharacterId;
  name: string;
  skin: string;
  shirt: string;
  tint: string;
  hair: string;
  /** Headwrap band / cap button. 'none' hides it. */
  band: string;
  hairD: string;
  brimD: string;
  bandD: string;
  /** Two optional hair circles (puffs, wrap knot, cap button). r = 0 hides. */
  puffA: [cx: number, cy: number, r: number];
  puffB: [cx: number, cy: number, r: number];
}

export const CHARACTERS: Record<CharacterId, CharacterLook> = {
  topsy: {
    id: 'topsy',
    name: 'Topsy',
    skin: '#8D5524',
    shirt: '#FF8A3D',
    tint: '#FFE7D6',
    hair: '#1A1110',
    band: 'none',
    hairD: 'M26 44 C25 23 36 15 50 15 C64 15 75 23 74 44 C71 33 63 27 50 27 C37 27 29 33 26 44Z',
    brimD: '',
    bandD: '',
    puffA: [50, 20, 0],
    puffB: [50, 20, 0],
  },
  tolu: {
    id: 'tolu',
    name: 'Tolu',
    skin: '#6B3E1F',
    shirt: '#2F86DB',
    tint: '#D7EAFB',
    hair: '#1A1110',
    band: 'none',
    hairD: 'M27 40 C28 24 38 19 50 19 C62 19 72 24 73 40 C68 32 60 29 50 29 C40 29 32 32 27 40Z',
    brimD: '',
    bandD: '',
    puffA: [28, 24, 12],
    puffB: [72, 24, 12],
  },
  ada: {
    id: 'ada',
    name: 'Ada',
    skin: '#A0673C',
    shirt: '#4CD37F',
    tint: '#DDF7E7',
    hair: '#FFB21E',
    band: '#E5484D',
    hairD: 'M22 42 C19 15 37 6 52 8 C70 10 82 22 78 42 C70 30 60 26 50 26 C40 26 30 31 22 42Z',
    brimD: '',
    bandD: 'M27 30 Q50 18 74 30',
    puffA: [50, 20, 0],
    puffB: [72, 12, 9],
  },
  emeka: {
    id: 'emeka',
    name: 'Emeka',
    skin: '#3F220C',
    shirt: '#9B6BE0',
    tint: '#EDE3FB',
    hair: '#E5484D',
    band: '#FFFFFF',
    hairD: 'M26 40 C26 20 38 13 50 13 C62 13 74 20 74 40Z',
    brimD: 'M52 36 L88 38 Q90 44 82 44 L52 42Z',
    bandD: 'M50 14 L50 22',
    puffA: [50, 13, 3],
    puffB: [50, 20, 0],
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
