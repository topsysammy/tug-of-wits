import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from '../ui/Icon.tsx';

export type StatusTone = 'muted' | 'me' | 'opp' | 'danger' | 'good';

const TONE: Record<StatusTone, string> = {
  muted: 'text-muted',
  me: 'text-me-ink',
  opp: 'text-opp-ink',
  danger: 'text-danger-text',
  good: 'text-[#157A43]',
};

interface StatusLineProps {
  text: string;
  tone: StatusTone;
  icon?: IconName;
  /** 0–1 share of the round left; null hides the bar. */
  timeLeft: number | null;
}

export function StatusLine({ text, tone, icon, timeLeft }: StatusLineProps) {
  const low = timeLeft !== null && timeLeft <= 0.3;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-5" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className={`absolute inset-0 flex items-center gap-1.5 text-[15px] font-extrabold ${TONE[tone]}`}
          >
            {icon && <Icon name={icon} size={16} strokeWidth={2.8} />}
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="h-2.5 overflow-hidden rounded-[5px] bg-track" aria-hidden="true">
        <div
          className="h-full rounded-[5px] transition-[width,background-color] duration-100 ease-linear"
          style={{
            width: `${(timeLeft ?? 0) * 100}%`,
            backgroundColor: low ? '#FF5A5A' : 'var(--color-blue)',
          }}
        />
      </div>
    </div>
  );
}
