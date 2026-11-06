import { motion } from 'framer-motion';
import { RECONNECT_GRACE_SECONDS } from '@shared/gameConfig.ts';
import type { PlayerInfo } from '@shared/types.ts';
import { Avatar } from '../Avatar.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { useNow } from '../../hooks/useNow.ts';

interface DisconnectOverlayProps {
  opp: PlayerInfo;
  forfeitAt: number;
  onLeave: () => void;
}

export function DisconnectOverlay({ opp, forfeitAt, onLeave }: DisconnectOverlayProps) {
  const now = useNow(true, 200);
  const leftMs = Math.max(0, forfeitAt - now);
  const pct = leftMs / (RECONNECT_GRACE_SECONDS * 1000);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col justify-end gap-3.5 bg-ink/50 p-5"
      role="alertdialog"
      aria-labelledby="dc-title"
      aria-describedby="dc-desc"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        className="flex flex-col items-center gap-3 rounded-[28px] border-[3px] border-white bg-cream px-5 py-6 text-center shadow-[0_5px_0_var(--color-card-shadow)]"
      >
        <div className="relative">
          <Avatar who={opp.character} size={88} decorative />
          <span className="absolute -right-1 -bottom-0.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-white bg-wrong text-wrong-ink">
            <Icon name="wifiOff" size={18} strokeWidth={2.6} />
          </span>
        </div>
        <h2 id="dc-title" className="m-0 font-display text-[26px] leading-tight font-bold">
          {opp.nickname} lost connection
        </h2>
        <p id="dc-desc" className="m-0 text-[15px] leading-snug font-bold text-muted">
          Match paused. If {opp.nickname} isn't back in time, you win by forfeit.
        </p>
        <div className="mt-1 flex w-full flex-col gap-1.5">
          <div className="flex justify-between text-sm font-extrabold">
            <span>Waiting…</span>
            <span className="tabular-nums">{Math.ceil(leftMs / 1000)}s</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-[5px] bg-track">
            <div className="h-full rounded-[5px] bg-blue transition-[width] duration-200 ease-linear" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      </motion.div>
      <Button variant="white" onClick={onLeave}>
        Leave match
      </Button>
    </motion.div>
  );
}
