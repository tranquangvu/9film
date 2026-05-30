import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 active:scale-97',
        ghost:
          'glass border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10 hover:border-white/25',
        icon: 'glass border border-white/15 text-zinc-300 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-110 active:scale-95 shadow-lg',
        outline:
          'border text-zinc-400 border-white/10 hover:border-white/20 hover:text-white bg-white/5',
        destructive: 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm rounded-full',
        md: 'px-5 py-2.5 text-sm rounded-full',
        lg: 'px-8 py-3.5 text-base rounded-full',
        icon: 'w-10 h-10 rounded-full',
        'icon-sm': 'w-9 h-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
