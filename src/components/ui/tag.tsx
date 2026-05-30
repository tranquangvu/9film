import { type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils';

const tagVariants = cva(
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border cursor-pointer',
  {
    variants: {
      active: {
        true: 'bg-orange-500/20 border-orange-500/60 text-orange-400',
        false: 'text-zinc-400 border-white/10 hover:border-white/20 hover:text-white bg-white/5',
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
