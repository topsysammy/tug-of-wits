import { AnimatePresence, motion } from 'framer-motion';
import type { PublicQuestion } from '@shared/types.ts';
import { CATEGORIES } from '../../game/categories.ts';

interface QuestionCardProps {
  question: PublicQuestion | null;
  suddenDeath: boolean;
  /** Shown instead of the question (e.g. while paused). */
  placeholder?: string;
}

export function QuestionCard({ question, suddenDeath, placeholder }: QuestionCardProps) {
  const cat = question ? CATEGORIES[question.category] : null;
  return (
    <div className="flex min-h-[112px] flex-col gap-2 overflow-hidden rounded-3xl border-2 border-card-edge bg-card p-[18px] shadow-[0_4px_0_var(--color-card-shadow)]">
      <div className="flex flex-wrap gap-1.5">
        {cat && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-extrabold"
            style={{ background: cat.chipBg, color: cat.chipText }}
          >
            {cat.label}
          </span>
        )}
        {suddenDeath && (
          <span className="rounded-full bg-wrong px-2.5 py-0.5 text-xs font-extrabold text-wrong-ink">
            Sudden death: next pull wins
          </span>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={question?.id ?? placeholder ?? 'empty'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className={`m-0 font-display text-[21px] leading-tight font-semibold ${question ? '' : 'text-muted'}`}
        >
          {question ? question.text : placeholder ?? 'Get ready…'}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
