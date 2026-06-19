import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const pill = 'px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border', {
  variants: {
    variant: {
      default: `${pill} bg-white/10 text-zinc-300 border-white/15`,
      orange: `${pill} bg-orange-500/20 text-orange-400 border-orange-500/30`,
      emerald: `${pill} bg-emerald-500/20 text-emerald-400 border-emerald-500/30`,
      series: `${pill} bg-white/10 text-zinc-300 border-white/15`,
      // Interactive chip (formerly the Tag component) — rendered as a <button>.
      tag: 'px-3 py-1.5 text-sm font-medium transition-all duration-200 select-none',
    },
    active: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    // Highlighted (currently playing / watched) — solid brand orange.
    { variant: 'tag', active: true, class: 'border-orange-500 bg-orange-500 text-white' },
    {
      variant: 'tag',
      active: false,
      class:
        'cursor-pointer border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white',
    },
  ],
  defaultVariants: {
    variant: 'default',
    active: false,
  },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, active, ...props }: BadgeProps) {
  const classes = cn(badgeVariants({ variant, active }), className);
  // The `tag` variant is interactive, so it renders as a real button.
  if (variant === 'tag') {
    return <button className={classes} {...props} />;
  }
  return <span className={classes} {...props} />;
}

export { Badge, badgeVariants };
