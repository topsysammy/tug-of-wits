interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  columns?: number;
}

/** Radio group drawn as chunky chips. */
export function Segmented<T extends string>({ label, value, options, onChange, columns = options.length }: SegmentedProps<T>) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={[
            'flex min-h-12 flex-col items-center justify-center rounded-2xl px-2 py-1.5 font-display text-base leading-tight font-semibold transition-colors',
            value === o.value ? 'bg-blue text-white shadow-[0_4px_0_var(--color-blue-deep)]' : 'bg-ground text-ink',
            o.disabled ? 'opacity-50' : '',
          ].join(' ')}
        >
          {o.label}
          {o.hint && <span className="font-body text-[11px] font-extrabold opacity-80">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}
