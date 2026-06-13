import { type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const tagVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 select-none',
  {
    variants: {
      active: {
        true: 'border-orange-500/60 bg-orange-500/20 text-orange-400',
        false: 'cursor-pointer border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white',
      },
      // Episodes that already have saved watch progress. The active (currently
      // playing) state always wins — see the compoundVariant below.
      watched: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        active: false,
        watched: true,
        class:
          'border-orange-400/60 bg-orange-400/20 text-orange-300 hover:border-orange-400/80 hover:bg-orange-400/30 hover:text-orange-200',
      },
    ],
    defaultVariants: {
      active: false,
      watched: false,
    },
  },
);

export interface TagProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tagVariants> {}

function Tag({ className, active, watched, ...props }: TagProps) {
  return <button className={cn(tagVariants({ active, watched }), className)} {...props} />;
}

export { Tag, tagVariants };
