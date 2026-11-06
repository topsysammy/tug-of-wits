import type { CategoryId } from '@shared/types.ts';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Chip colours on the question card. */
  chipBg: string;
  chipText: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  'quick-maths': { id: 'quick-maths', label: 'Quick Maths', chipBg: '#FFF1C9', chipText: '#8A5A00' },
  'general-knowledge': { id: 'general-knowledge', label: 'General Knowledge', chipBg: '#D7EAFB', chipText: '#1E5A99' },
  'naija-trivia': { id: 'naija-trivia', label: 'Naija Trivia', chipBg: '#DDF7E7', chipText: '#157A43' },
  science: { id: 'science', label: 'Science', chipBg: '#EDE3FB', chipText: '#5B3A9E' },
  football: { id: 'football', label: 'Football', chipBg: '#FFE7D6', chipText: '#A33A00' },
  'bible-quran': { id: 'bible-quran', label: 'Bible & Quran Stories', chipBg: '#FDE2E2', chipText: '#9B2C2C' },
};
