import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon.tsx';

export type TileLook = 'idle' | 'picked' | 'correct' | 'wrong' | 'muted';

const LOOK: Record<TileLook, string> = {
  idle: 'bg-yellow text-yellow-ink shadow-[0_5px_0_var(--color-yellow-deep)] enabled:active:translate-y-1 enabled:active:shadow-none',
  picked: 'bg-yellow text-yellow-ink translate-y-1 shadow-[0_1px_0_var(--color-yellow-deep)] ring-4 ring-white',
  correct: 'bg-correct text-correct-ink shadow-[0_5px_0_var(--color-correct-deep)]',
  wrong: 'bg-wrong text-wrong-ink shadow-[0_5px_0_var(--color-wrong-deep)]',
  muted: 'bg-muted-tile text-muted shadow-[0_5px_0_var(--color-muted-tile-deep)]',
};

interface AnswerGridProps {
  options: string[] | null;
  looks: TileLook[];
  disabled: boolean;
  onPick: (i: number) => void;
}

function Tile({ label, look, disabled, onPick }: { label: string; look: TileLook; disabled: boolean; onPick: () => void }) {
  const anim =
    look === 'wrong'
      ? { x: [0, -8, 8, -6, 6, -3, 0], transition: { duration: 0.4 } }
      : look === 'correct'
        ? { scale: [1, 1.06, 1], transition: { duration: 0.35 } }
        : { x: 0, scale: 1 };
  return (
    <motion.button
      type="button"
      animate={anim}
      disabled={disabled}
      onPointerDown={(e) => {
        // Fire on press, not release: every millisecond counts in a race.
        if (e.button === 0 && !disabled) onPick();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onPick();
        }
      }}
      className={[
        'relative flex h-[74px] items-center justify-center rounded-[20px] px-3 text-center font-display text-[19px] leading-tight font-semibold',
        'transition-[transform,box-shadow,background-color,color] duration-75 select-none',
        LOOK[look],
      ].join(' ')}
    >
      {look === 'correct' && <Icon name="check" size={18} strokeWidth={3} className="absolute top-2 right-2.5" />}
      {look === 'wrong' && <Icon name="x" size={16} strokeWidth={3} className="absolute top-2 right-2.5" />}
      <span className="line-clamp-2">{label}</span>
    </motion.button>
  );
}

export function AnswerGrid({ options, looks, disabled, onPick }: AnswerGridProps) {
  if (!options) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[74px] rounded-[20px] bg-muted-tile shadow-[0_5px_0_var(--color-muted-tile-deep)]" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((label, i) => (
        <Tile key={`${i}-${label}`} label={label} look={looks[i] ?? 'idle'} disabled={disabled} onPick={() => onPick(i)} />
      ))}
    </div>
  );
}
