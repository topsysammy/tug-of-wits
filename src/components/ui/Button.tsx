import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'yellow' | 'blue' | 'whatsapp' | 'white';

const VARIANTS: Record<ButtonVariant, string> = {
  yellow: 'bg-yellow text-yellow-ink shadow-[0_5px_0_var(--color-yellow-deep)]',
  blue: 'bg-blue text-white shadow-[0_5px_0_var(--color-blue-deep)]',
  whatsapp: 'bg-whatsapp text-whatsapp-ink shadow-[0_5px_0_var(--color-whatsapp-deep)]',
  white: 'bg-card text-ink border-2 border-card-edge shadow-[0_5px_0_var(--color-card-shadow)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  block?: boolean;
}

/** Chunky 58px button. Pressing drops the shadow and nudges it down 4px. */
export function Button({ variant = 'yellow', icon, block = true, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'flex h-[58px] items-center justify-center gap-2 rounded-[20px] px-5 font-display text-xl font-semibold',
        'transition-[transform,box-shadow] duration-75 select-none',
        'enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-50',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
