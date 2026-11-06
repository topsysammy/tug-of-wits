interface StatBarProps {
  questionNumber: number;
  secondsLeft: number;
  wins: { me: number; opp: number };
}

function Stat({ label, children, alarm = false }: { label: string; children: React.ReactNode; alarm?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-extrabold text-yellow-label">{label}</span>
      <span
        className={[
          'flex h-10 w-full items-center justify-center rounded-xl font-display text-xl font-bold tabular-nums transition-colors',
          alarm ? 'bg-wrong text-wrong-ink' : 'bg-card text-ink',
        ].join(' ')}
      >
        {children}
      </span>
    </div>
  );
}

export function StatBar({ questionNumber, secondsLeft, wins }: StatBarProps) {
  const secs = Math.ceil(secondsLeft);
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-yellow p-3 shadow-[0_5px_0_var(--color-yellow-deep)]">
      <Stat label="Question">{questionNumber || '–'}</Stat>
      <Stat label="Time" alarm={secondsLeft > 0 && secondsLeft <= 3}>
        <span aria-label={`${secs} seconds left`}>00:{String(secs).padStart(2, '0')}</span>
      </Stat>
      <Stat label="Score">
        <span aria-label={`You ${wins.me}, opponent ${wins.opp}`}>
          {wins.me} – {wins.opp}
        </span>
      </Stat>
    </div>
  );
}
