import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, type Transition } from 'framer-motion';
import { STEPS_TO_WIN } from '@shared/gameConfig.ts';
import type { PlayerInfo } from '@shared/types.ts';
import { Avatar } from '../Avatar.tsx';
import type { Who } from '../../hooks/useMatch.ts';

interface ArenaProps {
  me: PlayerInfo;
  opp: PlayerInfo;
  /** My perspective: negative = toward my (left) line. */
  pos: number;
  /** Who pulled in the round being revealed, if anyone. */
  pulledBy: Who | null;
  /** Bumps on each pull; triggers the shake. */
  pullSeq: number;
  /** Fade the opponent while they're disconnected. */
  oppFaded?: boolean;
}

const WIN_LINE_X = 35; // centre of each win line from its edge, px
const CHAR_SIZE = 76;
/** How far the winning puller may back up; past that the rope slides through their hands. */
const MAX_BACK = 24;
const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 15, mass: 0.9 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(344);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function stepsLabel(pos: number, oppName: string) {
  if (pos === 0) return 'Dead centre';
  const left = STEPS_TO_WIN - Math.abs(pos);
  if (left <= 0) return pos < 0 ? 'Across the line!' : `${oppName} wins!`;
  if (pos < 0) return left === 1 ? '1 more to win!' : `${left} more to win`;
  return `${oppName} needs ${left}`;
}

export function Arena({ me, opp, pos, pulledBy, pullSeq, oppFaded = false }: ArenaProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const shake = useAnimationControls();
  const centre = width / 2;
  const step = (centre - WIN_LINE_X) / STEPS_TO_WIN;
  const shift = pos * step;

  useEffect(() => {
    if (pullSeq === 0) return;
    void shake.start({ x: [0, -7, 7, -5, 5, -2, 0], transition: { duration: 0.42, ease: 'easeOut' } });
  }, [pullSeq, shake]);

  // Losing side strains; on a pull the puller leans back and the other gets yanked forward.
  const meStrain = pos > 0 || pulledBy === 'opp';
  const oppStrain = pos < 0 || pulledBy === 'me';
  const meLean = pulledBy === 'me' ? -12 : pulledBy === 'opp' ? 10 : pos > 0 ? 4 : -3;
  const oppLean = pulledBy === 'opp' ? 12 : pulledBy === 'me' ? -10 : pos < 0 ? -4 : 3;
  const oppName = opp.nickname;

  return (
    <motion.div
      animate={shake}
      ref={ref}
      role="img"
      aria-label={`Rope position: ${stepsLabel(pos, oppName)}`}
      className="relative h-[176px] overflow-hidden rounded-3xl border-[3px] border-white bg-sky shadow-[0_4px_0_var(--color-sky-shadow)]"
    >
      {/* end zones + win lines */}
      <div className="absolute inset-y-0 left-0 w-[34px] bg-[#FCE3CF]" />
      <div className="absolute inset-y-0 right-0 w-[34px] bg-[#BCD9F5]" />
      <div className="absolute inset-y-3.5 left-[33px] w-1 rounded-sm bg-me" />
      <div className="absolute inset-y-3.5 right-[33px] w-1 rounded-sm bg-opp" />
      <div
        className="absolute top-[50px] bottom-[30px] w-0 border-l-[3px] border-dashed border-white"
        style={{ left: centre - 1.5 }}
      />

      <div className="absolute inset-x-0 top-3 flex justify-center">
        <motion.span
          key={stepsLabel(pos, oppName)}
          initial={{ scale: 0.85, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-full bg-white px-3 py-1 text-[13px] font-extrabold"
        >
          {stepsLabel(pos, oppName)}
        </motion.span>
      </div>

      {/* Rope, knot and both pullers slide together. The winner can only back up so far
          (they'd hit the wall), so the loser visibly gets dragged toward the centre. */}
      <motion.div className="absolute inset-0" animate={{ x: shift }} transition={SPRING} initial={false}>
        <div
          className="absolute top-[112px] h-2.5 rounded-[5px] shadow-[0_2px_0_rgba(120,80,30,0.25)]"
          style={{
            left: -width,
            right: -width,
            background: 'repeating-linear-gradient(115deg, #D9A55B 0 9px, #A8743A 9px 16px)',
          }}
        />
      </motion.div>
      {/* Knot sits under the pullers: near the end it disappears into the winner's grip. */}
      <motion.div
        className="absolute top-[104px] h-7 w-7 rounded-full border-4 border-white bg-[#FF5A5A] shadow-[0_3px_0_#C53030]"
        style={{ left: centre - 14 }}
        initial={false}
        animate={{ x: shift }}
        transition={SPRING}
      />
      <motion.div
        className="absolute top-[66px] left-[30px] origin-bottom"
        initial={false}
        animate={{ x: Math.max(shift, -MAX_BACK), rotate: meLean }}
        transition={SPRING}
      >
        <Avatar who={me.character} pose="pull" mood={meStrain ? 'strain' : 'happy'} size={CHAR_SIZE} decorative />
      </motion.div>
      <motion.div
        className="absolute top-[66px] right-[30px] origin-bottom"
        initial={false}
        animate={{ x: Math.min(shift, MAX_BACK), rotate: oppLean, opacity: oppFaded ? 0.35 : 1 }}
        transition={SPRING}
      >
        <Avatar who={opp.character} pose="pull" mood={oppStrain ? 'strain' : 'happy'} size={CHAR_SIZE} flip decorative />
      </motion.div>

      <span className="absolute top-4 left-11 text-xs font-extrabold text-me-ink">You</span>
      <span className="absolute top-4 right-11 max-w-[22%] truncate text-xs font-extrabold text-opp-ink">
        {oppName}
      </span>
    </motion.div>
  );
}
