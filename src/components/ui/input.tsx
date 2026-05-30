import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full bg-transparent text-white placeholder:text-zinc-500 outline-none transition-all duration-200',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
