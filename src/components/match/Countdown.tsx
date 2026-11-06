import { AnimatePresence, motion } from 'framer-motion';
import { STEPS_TO_WIN } from '@shared/gameConfig.ts';
import type { CategoryId, PlayerInfo } from '@shared/types.ts';
import { Avatar } from '../Avatar.tsx';
import { CATEGORIES } from '../../game/categories.ts';
import { useNow } from '../../hooks/useNow.ts';

interface CountdownProps {
  me: PlayerInfo;
  opp: PlayerInfo;
  category: CategoryId | null;
  endsAt: number;
}

function PlayerCard({ p, you }: { p: PlayerInfo; you: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-white px-2 py-4 shadow-[0_5px_0_var(--color-sky-shadow)]">
      <Avatar who={p.character} size={104} decorative />
      <span className="max-w-full truncate font-display text-xl font-semibold">{p.nickname}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${you ? 'bg-me-tint text-me-ink' : 'bg-opp-tint text-opp-ink'}`}
      >
        {you ? 'You' : 'Opponent'}
      </span>
    </div>
  );
}

export function Countdown({ me, opp, category, endsAt }: CountdownProps) {
  const now = useNow(true, 50);
  const n = Math.max(1, Math.ceil((endsAt - now) / 1000));
  return (
    <div className="flex min-h-dvh flex-col items-center gap-7 bg-sky px-5 pt-[72px] pb-10">
      <span className="rounded-full bg-white px-4 py-2 text-[15px] font-extrabold shadow-[0_4px_0_var(--color-sky-shadow)]">
        {category ? CATEGORIES[category].label : 'Quiz'} · First to {STEPS_TO_WIN}
      </span>
      <div className="grid w-full max-w-[420px] grid-cols-2 gap-4">
        <PlayerCard p={me} you />
        <PlayerCard p={opp} you={false} />
      </div>
      <div
        className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-8 border-white bg-yellow shadow-[0_10px_0_var(--color-yellow-deep)]"
        role="timer"
        aria-live="assertive"
        aria-label={`Starting in ${n}`}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="font-display text-[110px] leading-none font-bold text-yellow-ink"
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 text-center">
        <span className="font-display text-[28px] font-bold">Get ready to pull!</span>
        <span className="text-[15px] font-bold text-[#4F5D6E]">Keep your thumb close to the answers</span>
      </div>
    </div>
  );
}
