import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon.tsx';

export function LockedPill({ oppName }: { oppName: string }) {
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center gap-2.5 self-center rounded-full border-2 border-card-edge bg-card px-4 py-2.5"
    >
      <Icon name="lock" size={18} className="text-danger-text" />
      <span className="text-sm font-extrabold">{oppName} can take their time now</span>
    </motion.div>
  );
}
