import { type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const tagVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 select-none',
  {
    variants: {
      active: {
        // Highlighted (currently playing / watched) — solid brand orange.
        true: 'border-orange-500 bg-orange-500 text-white',
        false: 'cursor-pointer border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white',
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface TagProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tagVariants> {}

function Tag({ className, active, ...props }: TagProps) {
  return <button className={cn(tagVariants({ active }), className)} {...props} />;
}

export { Tag, tagVariants };
