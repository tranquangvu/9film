import { type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: ReactNode
  compact?: boolean
  options: { id: string; label: string }[]
}

function Select({ icon, compact, options, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none flex items-center">
          {icon}
        </div>
      )}
      <select
        className={cn(
          'appearance-none pr-8 py-1.5 rounded-full bg-white/8 border border-white/12 text-white text-sm font-medium cursor-pointer transition-all hover:bg-white/12 hover:border-white/20 focus:outline-none focus:border-orange-500/60',
          icon ? 'pl-8' : 'pl-3.5',
          compact && 'w-28',
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-zinc-900 text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
      />
    </div>
  );
}

export { Select };
