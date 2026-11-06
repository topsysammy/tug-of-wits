/** Quick Maths questions, generated on the server so the supply never runs out. */
import type { Difficulty, SecretQuestion } from './types.ts';

type Rng = () => number;

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

function makeProblem(rng: Rng, difficulty: Difficulty): { text: string; answer: number } {
  const kind = int(rng, 0, 3);
  if (difficulty === 'easy') {
    if (kind === 0) {
      const a = int(rng, 2, 20), b = int(rng, 2, 20);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    if (kind === 1) {
      const a = int(rng, 10, 30), b = int(rng, 2, a - 1);
      return { text: `${a} − ${b}`, answer: a - b };
    }
    const a = int(rng, 2, 9), b = int(rng, 2, 9);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (difficulty === 'medium') {
    if (kind === 0) {
      const a = int(rng, 3, 12), b = int(rng, 3, 12);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    if (kind === 1) {
      const b = int(rng, 3, 12), q = int(rng, 3, 12);
      return { text: `${b * q} ÷ ${b}`, answer: q };
    }
    if (kind === 2) {
      const a = int(rng, 25, 99), b = int(rng, 25, 99);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    const a = int(rng, 50, 150), b = int(rng, 11, 49);
    return { text: `${a} − ${b}`, answer: a - b };
  }
  // hard
  if (kind === 0) {
    const a = int(rng, 12, 29), b = int(rng, 11, 19);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (kind === 1) {
    const b = int(rng, 6, 19), q = int(rng, 6, 19);
    return { text: `${b * q} ÷ ${b}`, answer: q };
  }
  if (kind === 2) {
    const a = int(rng, 2, 12), b = int(rng, 2, 12), c = int(rng, 5, 40);
    return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
  }
  const n = int(rng, 11, 25);
  return { text: `${n}²`, answer: n * n };
}

/** Plausible wrong answers close to the right one, all distinct and positive. */
function distractors(rng: Rng, answer: number): number[] {
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.15));
  const out = new Set<number>();
  const near = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2, answer - 2];
  while (out.size < 3) {
    const pick = rng() < 0.5 ? near[int(rng, 0, near.length - 1)] : answer + int(rng, -spread, spread);
    if (pick !== answer && pick >= 0) out.add(pick);
  }
  return [...out];
}

export function generateMathQuestion(difficulty: Difficulty, rng: Rng = Math.random, id?: string): SecretQuestion {
  const { text, answer } = makeProblem(rng, difficulty);
  const options = [answer, ...distractors(rng, answer)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    id: id ?? `math-${Math.floor(rng() * 1e9).toString(36)}`,
    text: `${text} = ?`,
    options: options.map(String),
    correctIndex: options.indexOf(answer),
    category: 'quick-maths',
    difficulty,
  };
}
