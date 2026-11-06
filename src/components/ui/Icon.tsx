/** Stroke icons (24×24 grid). Decorative by default; pass `label` when the icon stands alone. */
const PATHS = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  lock: ['M5 11h14v10H5z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  wifiOff: [
    'M2 2l20 20',
    'M8.5 16.5a5 5 0 0 1 7 0',
    'M5 12.6a10 10 0 0 1 5.2-2.5',
    'M19 12.6a10 10 0 0 0-2.6-1.8',
    'M12 20h.01',
  ],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  trophy: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0V4z', 'M17 5h3v2a3 3 0 0 1-3 3', 'M7 5H4v2a3 3 0 0 0 3 3'],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  sliders: ['M21 4h-7', 'M10 4H3', 'M21 12h-9', 'M8 12H3', 'M21 20h-5', 'M12 20H3', 'M14 2v4', 'M8 10v4', 'M16 18v4'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  share: ['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7', 'M16 6l-4-4-4 4', 'M12 2v13'],
  copy: ['M9 9h12v12H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  plus: ['M12 5v14', 'M5 12h14'],
  play: ['M7 5l12 7-12 7z'],
  hourglass: ['M6 3h12', 'M6 21h12', 'M7 3c0 5 10 5 10 9s-10 4-10 9', 'M17 3c0 5-10 5-10 9s10 4 10 9'],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, size = 20, strokeWidth = 2.4, className, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
